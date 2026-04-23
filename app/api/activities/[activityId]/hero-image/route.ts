import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Activity from "@/models/Activity";
import { buildGooglePlacePhotoUpstreamUrl } from "@/lib/travel/googlePlaces";

/**
 * Proxies a Google Places hero image so the browser never sees the API key (US15).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> },
) {
  try {
    // we cast the function to any before calling it to skip the "no exported member" check
    const session = await (getServerSession as any)(authOptions);
    const rawId =
      session?.user && "id" in session.user
        ? (session.user as { id: string }).id
        : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;
    await dbConnect();
    const activity = await Activity.findOne({ activityId: activityId });
    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 },
      );
    }

    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key) {
      return NextResponse.json(
        { error: "Maps not configured" },
        { status: 503 },
      );
    }

    const doc = activity as {
      googlePhotoMediaResource?: string;
      googlePhotoReference?: string;
    };

    const upstream = buildGooglePlacePhotoUpstreamUrl(
      {
        googlePhotoMediaResource: doc.googlePhotoMediaResource,
        googlePhotoReference: doc.googlePhotoReference,
      },
      key,
    );
    if (!upstream) {
      return NextResponse.json(
        { error: "No photo for this activity" },
        { status: 404 },
      );
    }

    const res = await fetch(upstream, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not load place photo" },
        { status: 502 },
      );
    }

    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";

    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}

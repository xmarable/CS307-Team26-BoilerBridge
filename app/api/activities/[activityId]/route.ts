import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Activity from "@/models/Activity";
import { enrichActivityForApi } from "@/lib/travel/enrichActivityForApi";

/**
 * GET /api/activities/[activityId]
 * US15: Activity details + optional Google Places enrichment (GOOGLE_MAPS_API_KEY).
 * US16: bookingUrl (manual, Expedia Rapid, or hotel-search fallback).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ activityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const rawId =
      session?.user && "id" in session.user
        ? (session.user as { id: string }).id
        : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { activityId } = await params;
    if (!activityId || !mongoose.Types.ObjectId.isValid(activityId)) {
      return NextResponse.json({ error: "Invalid activity ID" }, { status: 400 });
    }

    await dbConnect();

    const activity = await Activity.findById(activityId).lean();
    if (!activity) {
      return NextResponse.json({ error: "Activity not found" }, { status: 404 });
    }

    const payload = await enrichActivityForApi(
      activity as Parameters<typeof enrichActivityForApi>[0],
    );

    return NextResponse.json(payload);
  } catch (err: unknown) {
    console.error("GET /api/activities/[activityId] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

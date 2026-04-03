import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  buildGooglePlacePhotoUpstreamUrl,
  fetchGooglePlaceEnrichment,
} from "@/lib/travel/googlePlaces";

/**
 * Hero image for unsaved / preview places (key stays on server).
 */
export async function GET(req: NextRequest) {
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

    const placeId = new URL(req.url).searchParams.get("placeId")?.trim();
    if (!placeId) {
      return NextResponse.json({ error: "placeId required" }, { status: 400 });
    }

    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (!key) {
      return NextResponse.json({ error: "Maps not configured" }, { status: 503 });
    }

    const enrichment = await fetchGooglePlaceEnrichment(key, {
      placeId,
      fallbackTextQuery: null,
    });
    if (!enrichment) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    const upstream = buildGooglePlacePhotoUpstreamUrl(enrichment, key);
    if (!upstream) {
      return NextResponse.json({ error: "No photo for this place" }, { status: 404 });
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
    console.error("GET preview hero-image error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}

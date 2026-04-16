import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrichActivityForApi } from "@/lib/travel/enrichActivityForApi";

/**
 * Full activity info payload for a Google Place that is not yet saved (US15/US16 preview).
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

    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get("placeId")?.trim();
    const name = searchParams.get("name")?.trim() || "Place";
    const address = searchParams.get("address")?.trim() || undefined;
    const destinationCity = searchParams.get("destination")?.trim() || undefined;

    if (!placeId && (!name || name.trim().length < 2)) {
      return NextResponse.json(
        { error: "Provide placeId, or name with at least 2 characters." },
        { status: 400 },
      );
    }

    const payload = await enrichActivityForApi({
      ...(placeId ? { placeId } : {}),
      name: name.trim() || "Place",
      address,
      reviewCount: 0,
      ...(destinationCity ? { destinationCity } : {}),
    });

    return NextResponse.json({ ...payload, isPreview: true });
  } catch (err: unknown) {
    console.error("GET /api/activities/preview error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}

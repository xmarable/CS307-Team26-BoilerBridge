import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Activity from "@/models/Activity";
import { searchPlacesText } from "@/lib/travel/googlePlaces";
import {
  getActiveAccessibilityRequirements,
  matchesAccessibilityRequirements,
  parseAccessibilityRequirementsFromSearchParams,
} from "@/lib/travel/accessibility";

function serializeId(id: unknown): string {
  if (id && typeof (id as { toString: () => string }).toString === "function") {
    return (id as { toString: () => string }).toString();
  }
  return String(id);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type ActivitySearchResultRow = {
  source: "saved" | "google";
  activityId?: string;
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  primaryType?: string;
  accessibility?: {
    wheelchairAccessible?: boolean;
    stepFree?: boolean;
    accessibleRestroom?: boolean;
    hearingAssistance?: boolean;
    visualAssistance?: boolean;
  };
  accessibilityMatch: boolean;
};

function formatPrimaryType(types?: string[]): string | undefined {
  if (!types?.length) return undefined;
  const skip = new Set(["point_of_interest", "establishment"]);
  const t = types.find((x) => x && !skip.has(x));
  if (!t) return undefined;
  return t
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function relevanceScore(query: string, row: ActivitySearchResultRow): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const name = row.name.toLowerCase();
  const addr = row.address?.toLowerCase() ?? "";
  let s = 0;
  if (name === q) s += 120;
  else if (name.startsWith(q)) s += 70;
  else if (name.includes(q)) s += 40;
  if (addr.includes(q)) s += 25;
  if (row.source === "saved") s += 12;
  if (typeof row.rating === "number" && row.rating >= 4.5) s += 3;
  return s;
}

/**
 * GET /api/activities/search?q=...&limit=
 * Merges Mongo activities with Google Text Search hits; dedupes by placeId.
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
    const q = searchParams.get("q")?.trim() ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") || "24", 10) || 24, 40);
    const parsedAccessibility =
      parseAccessibilityRequirementsFromSearchParams(searchParams);
    if (!parsedAccessibility.ok) {
      return NextResponse.json(
        {
          error: parsedAccessibility.error,
          details: parsedAccessibility.details,
        },
        { status: 400 },
      );
    }
    const activeAccessibility = getActiveAccessibilityRequirements(
      parsedAccessibility.data,
    );

    if (q.length < 2) {
      return NextResponse.json({
        results: [] as ActivitySearchResultRow[],
        googleQueried: false,
        activeAccessibilityRequirements: activeAccessibility,
      });
    }

    await dbConnect();

    const pattern = new RegExp(escapeRegex(q), "i");
    const locals = await Activity.find({
      $or: [{ name: pattern }, { address: pattern }],
    })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 20))
      .lean();

    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    let googleHits: Awaited<ReturnType<typeof searchPlacesText>> = [];
    let googleError = false;
    try {
      googleHits = await searchPlacesText(googleKey, q, 10);
    } catch (e) {
      console.warn("[activities/search] Google Places failed:", e);
      googleError = true;
    }

    const localPlaceIds = new Set(
      locals
        .map((d) => (d as { placeId?: string }).placeId?.trim())
        .filter(Boolean) as string[],
    );

    const merged: ActivitySearchResultRow[] = [];

    for (const doc of locals) {
      const d = doc as {
        _id: unknown;
        placeId?: string;
        name: string;
        address?: string;
        rating?: number;
        reviewCount?: number;
        googleTypes?: string[];
        wheelchairAccessible?: boolean;
        stepFree?: boolean;
        accessibleRestroom?: boolean;
        hearingAssistance?: boolean;
        visualAssistance?: boolean;
      };
      merged.push({
        source: "saved",
        activityId: serializeId(d._id),
        placeId: d.placeId?.trim() || "",
        name: d.name,
        address: d.address,
        rating: d.rating,
        reviewCount: d.reviewCount ?? 0,
        primaryType: formatPrimaryType(d.googleTypes),
        accessibility: {
          wheelchairAccessible:
            typeof d.wheelchairAccessible === "boolean"
              ? d.wheelchairAccessible
              : undefined,
          stepFree: typeof d.stepFree === "boolean" ? d.stepFree : undefined,
          accessibleRestroom:
            typeof d.accessibleRestroom === "boolean"
              ? d.accessibleRestroom
              : undefined,
          hearingAssistance:
            typeof d.hearingAssistance === "boolean"
              ? d.hearingAssistance
              : undefined,
          visualAssistance:
            typeof d.visualAssistance === "boolean" ? d.visualAssistance : undefined,
        },
        accessibilityMatch: false,
      });
    }

    for (const g of googleHits) {
      if (!g.placeId || localPlaceIds.has(g.placeId)) continue;
      merged.push({
        source: "google",
        placeId: g.placeId,
        name: g.name,
        address: g.address,
        rating: g.rating,
        reviewCount: g.userRatingCount,
        primaryType: formatPrimaryType(g.types),
        accessibility: {
          wheelchairAccessible: g.wheelchairAccessible,
          stepFree: g.stepFree,
          accessibleRestroom: g.accessibleRestroom,
        },
        accessibilityMatch: false,
      });
    }

    const strictFiltered = merged.filter((row) =>
      matchesAccessibilityRequirements(
        row.accessibility,
        parsedAccessibility.data,
      ),
    );

    for (const row of strictFiltered) {
      row.accessibilityMatch = true;
    }

    strictFiltered.sort((a, b) => relevanceScore(q, b) - relevanceScore(q, a));

    return NextResponse.json({
      results: strictFiltered.slice(0, limit),
      googleQueried: true,
      googlePartial: googleError,
      activeAccessibilityRequirements: activeAccessibility,
    });
  } catch (err: unknown) {
    console.error("GET /api/activities/search error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}

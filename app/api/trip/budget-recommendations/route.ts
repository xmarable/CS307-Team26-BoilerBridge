import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Trip from "@/models/Trip";
import Activity from "@/models/Activity";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import { applyRecommendationFilters } from "@/lib/tripRecommendations";

/**
 * GET /api/trip/budget-recommendations?tripId=...
 * Returns activity recommendations for the trip, filtered by:
 * - avoidActivities / avoidLocations (excluded from results)
 * - budgetMin / budgetMax from trip preferences (or query params)
 * US14: Budget-based location/activity suggestions.
 */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");
    const budgetMinParam = searchParams.get("budgetMin");
    const budgetMaxParam = searchParams.get("budgetMax");

    let avoidActivities: string[] = [];
    let avoidLocations: string[] = [];
    let budgetMin: number | undefined;
    let budgetMax: number | undefined;

    if (tripId) {
      const trip = await Trip.findById(tripId).lean();
      if (!trip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }

      const permissionResult = (await getMemberPermissions(
        trip.groupID,
        userId
      )) as { error?: string; status?: number };

      if (permissionResult.error) {
        return NextResponse.json(
          { error: permissionResult.error },
          { status: permissionResult.status ?? 403 }
        );
      }

      const t = trip as Record<string, unknown>;
      avoidActivities = (t.avoidActivities as string[]) ?? [];
      avoidLocations = (t.avoidLocations as string[]) ?? [];
      budgetMin = t.budgetMin as number | undefined;
      budgetMax = t.budgetMax as number | undefined;
    }

    if (budgetMinParam != null && budgetMinParam !== "") {
      const n = Number(budgetMinParam);
      if (!Number.isNaN(n)) budgetMin = n;
    }
    if (budgetMaxParam != null && budgetMaxParam !== "") {
      const n = Number(budgetMaxParam);
      if (!Number.isNaN(n)) budgetMax = n;
    }

    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50", 10) || 50,
      100
    );

    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .limit(limit * 2)
      .lean();

    const items = activities.map((a) => {
      const doc = a as {
        _id: unknown;
        name: string;
        address?: string;
        estimatedCost?: number;
      };
      return {
        _id: doc._id?.toString(),
        name: doc.name,
        address: doc.address,
        estimatedCost: doc.estimatedCost,
      };
    });

    const filtered = applyRecommendationFilters(items, {
      avoidActivities,
      avoidLocations,
      budgetMin,
      budgetMax,
    }).slice(0, limit);

    return NextResponse.json({
      recommendations: filtered,
      filters: {
        avoidActivities,
        avoidLocations,
        budgetMin,
        budgetMax,
      },
    });
  } catch (err: unknown) {
    console.error("GET /api/trip/budget-recommendations error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Trip from "@/models/Trip";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import { z } from "zod";
import { AccessibilityRequirementsSchema } from "@/lib/itinerary/schemas";

const preferencesSchema = z.object({
  tripId: z.string().min(1, "tripId is required"),
  avoidActivities: z.array(z.string()).optional(),
  avoidLocations: z.array(z.string()).optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
  accessibilityRequirements: AccessibilityRequirementsSchema.optional(),
});

/**
 * POST /api/trip/preferences
 * Store or update user preferences for a trip (avoid activities/locations, budget range).
 * US14: Activity Preferences (Avoid + Budget Suggestions)
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = preferencesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid input",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      tripId,
      avoidActivities,
      avoidLocations,
      budgetMin,
      budgetMax,
      accessibilityRequirements,
    } =
      parsed.data;

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const permissionResult = (await getMemberPermissions(
      trip.groupID,
      userId
    )) as { error?: string; status?: number; canEdit?: boolean };

    if (permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status ?? 403 }
      );
    }
    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot edit trip preferences" },
        { status: 403 }
      );
    }

    const update: Record<string, unknown> = {};
    if (avoidActivities !== undefined) update.avoidActivities = avoidActivities;
    if (avoidLocations !== undefined) update.avoidLocations = avoidLocations;
    if (budgetMin !== undefined) update.budgetMin = budgetMin;
    if (budgetMax !== undefined) update.budgetMax = budgetMax;
    if (accessibilityRequirements !== undefined) {
      update.accessibilityRequirements = accessibilityRequirements;
    }

    const updated = await Trip.findByIdAndUpdate(tripId, update, {
      new: true,
    }).lean();

    const t = updated as Record<string, unknown>;
    return NextResponse.json({
      tripId: t._id?.toString(),
      avoidActivities: t.avoidActivities ?? [],
      avoidLocations: t.avoidLocations ?? [],
      budgetMin: t.budgetMin,
      budgetMax: t.budgetMax,
      accessibilityRequirements: t.accessibilityRequirements ?? {},
    });
  } catch (err: unknown) {
    console.error("POST /api/trip/preferences error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

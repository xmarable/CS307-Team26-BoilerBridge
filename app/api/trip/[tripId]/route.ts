import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Trip from "@/models/Trip";
import MustHave from "@/models/MustHave";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import { generateRainyDayPlan } from "@/lib/rainyDayEngine";
import { AccessibilityRequirementsSchema } from "@/lib/itinerary/schemas";
import { ensureItinerarySectionIds } from "@/lib/itinerary/ensureItinerarySectionIds";
import { createTripNotif } from "@/lib/notifications";

const TripPatchSchema = z
  .object({
    fromCity: z.string().min(1).optional(),
    toCity: z.string().min(1).optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    mode: z.enum(["flight", "train", "bus", "taxi"]).optional(),
    budget: z.coerce.number().positive().optional(),
    tripConfirmed: z.boolean().optional(),
    avoidActivities: z.array(z.string()).optional(),
    avoidLocations: z.array(z.string()).optional(),
    budgetMin: z.union([z.number(), z.null()]).optional(),
    budgetMax: z.union([z.number(), z.null()]).optional(),
    accessibilityRequirements: AccessibilityRequirementsSchema.optional(),
    primaryItinerary: z.array(z.unknown()).optional(),
    rainyDayItinerary: z.array(z.unknown()).optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await context.params;
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await Trip.findById(tripId).lean();
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const permissionResult = await getMemberPermissions(
      trip.groupID,
      userId
    ) as { error?: string; status?: number; canEdit?: boolean };

    if (permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status ?? 403 }
      );
    }

    const t = trip as Record<string, unknown>;
    const groupIdStr = String(t.groupID ?? "");
    const mustHaveDocs = await MustHave.find({ groupId: groupIdStr as never })
      .sort({ createdAt: -1 })
      .lean();
    const mustHaves = mustHaveDocs.map((m) => {
      const doc = m as {
        _id: { toString(): string };
        name: string;
        address?: string;
        status?: string;
      };
      return {
        _id: doc._id.toString(),
        name: doc.name,
        address: doc.address,
        status: doc.status,
      };
    });

    const primaryRaw = (t.primaryItinerary ?? []) as Parameters<
      typeof ensureItinerarySectionIds
    >[0];
    const rainyRaw = (t.rainyDayItinerary ?? []) as Parameters<
      typeof ensureItinerarySectionIds
    >[0];
    const ensuredPrimary = ensureItinerarySectionIds(primaryRaw);
    const ensuredRainy = ensureItinerarySectionIds(rainyRaw);
    if (ensuredPrimary.changed || ensuredRainy.changed) {
      await Trip.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(String(tripId)) },
        {
          $set: {
            primaryItinerary: ensuredPrimary.next,
            rainyDayItinerary: ensuredRainy.next,
          },
        },
      );
    }

    const itineraryVersion =
      typeof t.itineraryVersion === "number" ? t.itineraryVersion : 0;

    return NextResponse.json({
      _id: t._id?.toString(),
      groupID: t.groupID?.toString(),
      userId: t.userId?.toString(),
      fromCity: t.fromCity,
      toCity: t.toCity,
      fromDate: t.fromDate,
      toDate: t.toDate,
      mode: t.mode,
      budget: t.budget,
      tripConfirmed: t.tripConfirmed,
      primaryItinerary: ensuredPrimary.next,
      rainyDayItinerary: ensuredRainy.next,
      itineraryVersion,
      avoidActivities: t.avoidActivities ?? [],
      avoidLocations: t.avoidLocations ?? [],
      budgetMin: t.budgetMin,
      budgetMax: t.budgetMax,
      accessibilityRequirements: t.accessibilityRequirements ?? {},
      mustHaves,
    });
  } catch (err: unknown) {
    console.error("GET /api/trip/[tripId] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await context.params;
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // AC Logic: Verify permissions using the groupID linked to the trip
    const permissionResult = (await getMemberPermissions(
      trip.groupID,
      userId,
    )) as any;

    if (permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }

    // AC: Given a member is a 'Viewer', When they attempt to edit the itinerary, Then the API blocks the request.
    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot edit group itineraries" },
        { status: 403 },
      );
    }

    const body = await req.json();

    if (body.primaryItinerary) {
      body.rainyDayItinerary = generateRainyDayPlan(body.primaryItinerary);
    }

    const parsed = TripPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid input",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const p = parsed.data;
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, 1> = {};

    for (const key of Object.keys(p) as Array<keyof typeof p>) {
      const value = p[key];
      if (value === undefined) continue;
      if (key === "budgetMin" || key === "budgetMax") {
        if (value === null) {
          $unset[key] = 1;
        } else {
          $set[key] = value;
        }
        continue;
      }
      $set[key] = value;
    }

    if (Object.keys($set).length === 0 && Object.keys($unset).length === 0) {
      return NextResponse.json(
        { error: "No supported fields to update." },
        { status: 400 },
      );
    }

    const mongoUpdate: Record<string, unknown> = {};
    if (Object.keys($set).length > 0) mongoUpdate.$set = $set;
    if (Object.keys($unset).length > 0) mongoUpdate.$unset = $unset;

    const updatedTrip = await Trip.findByIdAndUpdate(tripId, mongoUpdate, {
      new: true,
    });

    createTripNotif({
      groupID: trip.groupID,
      userId: userId,
      message: `Trip updated for ${trip.toCity}`
    });

    return NextResponse.json(updatedTrip, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/trip/[tripId] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ tripId: string }> },
) {
  try {
    const { tripId } = await context.params;
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const permissionResult = (await getMemberPermissions(
      trip.groupID,
      userId,
    )) as any;

    if (permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }

    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Viewers cannot delete items" },
        { status: 403 },
      );
    }

    await Trip.findByIdAndDelete(tripId);

    createTripNotif({
      groupID: trip.groupID,
      userId: userId,
      message: `Trip deleted for ${trip.toCity}`
    });

    return NextResponse.json({ message: "Trip deleted" }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/trip/[tripId] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

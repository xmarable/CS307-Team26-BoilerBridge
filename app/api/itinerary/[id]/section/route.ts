import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import Trip from "@/models/Trip";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import { ensureItinerarySectionIds } from "@/lib/itinerary/ensureItinerarySectionIds";

const ItineraryKindSchema = z.enum(["primary", "rainy"]);

const ActivityUpdatesSchema = z
  .object({
    name: z.string().min(1).optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    isOutdoor: z.boolean().optional(),
    category: z.string().optional(),
    location: z.string().optional(),
  })
  .strict();

const SectionPatchBodySchema = z
  .object({
    scope: z.enum(["activity", "day"]),
    dayId: z.string().min(1),
    activityId: z.string().min(1).optional(),
    updates: z.record(z.string(), z.unknown()),
    /** When set, must equal the trip's current `itineraryVersion` or the update is rejected with 409. */
    version: z.number().int().nonnegative().optional(),
    itineraryKind: ItineraryKindSchema.default("primary"),
  })
  .strict();

function buildSetForSection(
  path: "primaryItinerary" | "rainyDayItinerary",
  filterAlias: "elem" | "d",
  updates: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(updates)) {
    out[`${path}.$[${filterAlias}].${key}`] = updates[key];
  }
  return out;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id: tripId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return NextResponse.json({ error: "Invalid itinerary id" }, { status: 400 });
    }

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

    const oid = new mongoose.Types.ObjectId(tripId);

    const permissionResult = (await getMemberPermissions(
      String(trip.groupID),
      userId,
    )) as { error?: string; status?: number; canEdit?: boolean };

    if (permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status ?? 403 },
      );
    }

    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot edit itineraries" },
        { status: 403 },
      );
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = SectionPatchBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const body = parsed.data;
    if (body.scope === "activity" && !body.activityId) {
      return NextResponse.json(
        { error: "activityId is required when scope is activity" },
        { status: 400 },
      );
    }

    const rawUpdates = body.updates ?? {};
    const updatesParsed = ActivityUpdatesSchema.safeParse(rawUpdates);
    if (!updatesParsed.success) {
      return NextResponse.json(
        { error: updatesParsed.error.issues[0]?.message ?? "Invalid updates" },
        { status: 400 },
      );
    }
    const updates = updatesParsed.data;
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "updates must not be empty" }, { status: 400 });
    }

    const path =
      body.itineraryKind === "rainy" ? "rainyDayItinerary" : "primaryItinerary";

    const primaryArr = (trip as { primaryItinerary?: unknown[] }).primaryItinerary ?? [];
    const rainyArr = (trip as { rainyDayItinerary?: unknown[] }).rainyDayItinerary ?? [];
    const ensuredPrimary = ensureItinerarySectionIds(
      primaryArr as Parameters<typeof ensureItinerarySectionIds>[0],
    );
    const ensuredRainy = ensureItinerarySectionIds(
      rainyArr as Parameters<typeof ensureItinerarySectionIds>[0],
    );

    if (ensuredPrimary.changed || ensuredRainy.changed) {
      await Trip.collection.updateOne(
        { _id: oid },
        {
          $set: {
            primaryItinerary: ensuredPrimary.next,
            rainyDayItinerary: ensuredRainy.next,
          },
        },
      );
    }

    const elemMatch =
      body.scope === "activity"
        ? {
            itineraryActivityId: body.activityId,
            dayId: body.dayId,
          }
        : { dayId: body.dayId };

    const hasTarget = await Trip.findOne({
      _id: oid,
      [path]: { $elemMatch: elemMatch },
    })
      .select("_id")
      .lean();

    if (!hasTarget) {
      return NextResponse.json(
        { error: "Target section not found for this itinerary" },
        { status: 404 },
      );
    }

    const filter: Record<string, unknown> = { _id: oid };
    if (body.version !== undefined) {
      filter.itineraryVersion = body.version;
    }

    const $set = buildSetForSection(
      path,
      body.scope === "activity" ? "elem" : "d",
      updates as Record<string, unknown>,
    );

    const updateDoc: Record<string, unknown> = {
      $set: $set,
      $inc: { itineraryVersion: 1 },
    };

    const arrayFilters =
      body.scope === "activity"
        ? [
            {
              "elem.itineraryActivityId": body.activityId,
              "elem.dayId": body.dayId,
            },
          ]
        : [{ "d.dayId": body.dayId }];

    const result = await Trip.collection.updateOne(filter, updateDoc, {
      arrayFilters,
    });

    if (result.matchedCount === 0) {
      const live = await Trip.findById(tripId).select("itineraryVersion").lean();
      if (!live) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      if (body.version !== undefined) {
        const cv =
          typeof (live as { itineraryVersion?: number }).itineraryVersion === "number"
            ? (live as { itineraryVersion: number }).itineraryVersion
            : 0;
        return NextResponse.json(
          { error: "Itinerary version conflict", currentVersion: cv },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "Target section not found for this itinerary" },
        { status: 404 },
      );
    }

    const fresh = await Trip.findById(tripId).lean();
    if (!fresh) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const v =
      typeof (fresh as { itineraryVersion?: number }).itineraryVersion === "number"
        ? (fresh as { itineraryVersion: number }).itineraryVersion
        : 0;

    return NextResponse.json(
      {
        itineraryVersion: v,
        itineraryKind: body.itineraryKind,
        primaryItinerary: (fresh as { primaryItinerary?: unknown }).primaryItinerary,
        rainyDayItinerary: (fresh as { rainyDayItinerary?: unknown }).rainyDayItinerary,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error("PATCH /api/itinerary/[id]/section error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

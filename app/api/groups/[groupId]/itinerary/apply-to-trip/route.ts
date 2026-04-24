import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import {
  calendarEventsToTripActivities,
  normalizeRainyActivitiesForTrip,
} from "@/lib/itinerary/calendarEventsToTripActivities";
import { ensureItinerarySectionIds } from "@/lib/itinerary/ensureItinerarySectionIds";
import { generateRainyDayPlan } from "@/lib/rainyDayEngine";
import { getMemberPermissions } from "@/lib/roles";
import CalendarEvent from "@/models/CalendarEvent";
import Trip from "@/models/Trip";

const BodySchema = z.object({
  tripId: z.string().min(1),
  eventIds: z.array(z.string()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    const parsedBody = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Malformed" },
        { status: 400 },
      );
    }

    const { tripId, eventIds } = parsedBody.data;

    if (!mongoose.isValidObjectId(tripId)) {
      return NextResponse.json({ error: "Invalid trip id" }, { status: 400 });
    }

    await dbConnect();

    const permissionResult = await getMemberPermissions(groupId, userId);
    if ("error" in permissionResult && permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status ?? 403 },
      );
    }
    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot edit group itineraries" },
        { status: 403 },
      );
    }

    const trip = await Trip.findOne({
      _id: new mongoose.Types.ObjectId(tripId),
      groupID: groupId as never,
    }).lean();

    if (!trip) {
      return NextResponse.json(
        { error: "Trip not found for this group" },
        { status: 404 },
      );
    }

    const t = trip as Record<string, unknown>;
    const tripFrom = new Date(t.fromDate as Date);
    const tripTo = new Date(t.toDate as Date);
    tripTo.setHours(23, 59, 59, 999);

    const filter: Record<string, unknown> = {
      groupId,
      source: "itinerary",
      itineraryOptionStatus: { $ne: "removed" },
    };

    const requestedIds = eventIds?.filter((id) => mongoose.isValidObjectId(id));
    if (requestedIds && requestedIds.length > 0) {
      filter._id = {
        $in: requestedIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    let events = await CalendarEvent.find(filter).sort({ startTime: 1 }).lean();

    if (requestedIds?.length) {
      if (events.length !== requestedIds.length) {
        return NextResponse.json(
          {
            error:
              "Some selected events were not found or are not Spark itinerary activities.",
          },
          { status: 400 },
        );
      }
    } else {
      events = events.filter((ev) => {
        const s = new Date((ev as { startTime: Date }).startTime);
        if (Number.isNaN(s.getTime())) return false;
        return s >= tripFrom && s <= tripTo;
      });
    }

    if (events.length === 0) {
      return NextResponse.json(
        {
          error:
            "No calendar itinerary events to apply. Select events or generate an itinerary in the trip date range.",
        },
        { status: 400 },
      );
    }

    const mapped = calendarEventsToTripActivities(
      events as Parameters<typeof calendarEventsToTripActivities>[0],
    );
    const { next: primaryItinerary } = ensureItinerarySectionIds(mapped);

    const primaryForRainy = primaryItinerary.map((a) => ({
      ...a,
      title: a.name,
      eventType: a.category,
    }));

    const rainyRaw = await generateRainyDayPlan(primaryForRainy);
    const rainyPlain = normalizeRainyActivitiesForTrip(
      (Array.isArray(rainyRaw) ? rainyRaw : []) as Record<string, unknown>[],
    );
    const { next: rainyDayItinerary } = ensureItinerarySectionIds(rainyPlain);

    const updated = await Trip.findByIdAndUpdate(
      tripId,
      { $set: { primaryItinerary, rainyDayItinerary } },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Failed to update trip" }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        appliedCount: primaryItinerary.length,
        tripId: String((updated as { _id: unknown })._id),
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error("POST itinerary/apply-to-trip error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Server error", details: message }, { status: 500 });
  }
}

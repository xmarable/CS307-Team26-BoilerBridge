import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import Trip from "@/models/Trip";
import MustHave from "@/models/MustHave";
import CalendarEvent from "@/models/CalendarEvent";
import {
  generatePartialItinerary,
  type GeneratePartialItineraryInput,
} from "@/lib/itinerary/generatePartial";
import { mapTripToGenerationContext } from "@/lib/itinerary/mapTripToGenerationContext";
import { normalizeProposedTimeline } from "@/lib/itinerary/normalizeProposedTimeline";
import { filterProposedEventsByAvoidLists } from "@/lib/itinerary/filterProposedByAvoid";
import { resolveActivityLinksForProposals } from "@/lib/itinerary/resolveActivityLinks";
import { augmentResolvedLinksWithTextSearch } from "@/lib/itinerary/augmentResolvedLinksWithTextSearch";
import { filterProposedEventsByAccessibility } from "@/lib/itinerary/filterProposedByAccessibility";

const RegenerateBodySchema = z
  .object({
    eventIds: z.array(z.string().min(1)).optional(),
    dateRange: z
      .object({
        from: z.coerce.date(),
        to: z.coerce.date(),
      })
      .optional(),
    eventType: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.eventIds && data.eventIds.length > 0) return true;
      if (data.dateRange) return true;
      return false;
    },
    {
      message:
        "Provide non-empty eventIds or dateRange (optionally with eventType)",
    },
  );

function serializeEvent(ev: {
  _id: unknown;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  eventType?: string;
  timezone?: string;
  source?: string;
}) {
  return {
    _id: String(ev._id),
    title: ev.title,
    description: ev.description,
    startTime: ev.startTime.toISOString(),
    endTime: ev.endTime.toISOString(),
    location: ev.location,
    eventType: ev.eventType,
    timezone: ev.timezone,
    source: ev.source,
  };
}

function serializeProposed(ev: {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  eventType?: string;
  timezone?: string;
}) {
  return {
    title: ev.title,
    description: ev.description,
    startTime: ev.startTime.toISOString(),
    endTime: ev.endTime.toISOString(),
    location: ev.location,
    eventType: ev.eventType ?? "general",
    timezone: ev.timezone ?? "UTC",
  };
}

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
    const body = await req.json();
    const parsed = RegenerateBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    await dbConnect();

    const permissionResult = await getMemberPermissions(groupId, userId);
    if ("error" in permissionResult && permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }
    if (!permissionResult.canEdit) {
      return NextResponse.json(
        {
          error: "Forbidden: insufficient permissions to regenerate itinerary",
        },
        { status: 403 },
      );
    }

    const trip = await Trip.findOne({ groupID: groupId })
      .sort({ createdAt: -1 })
      .lean();
    if (!trip) {
      return NextResponse.json(
        {
          error:
            "No trip found for this group; create a trip before regenerating.",
        },
        { status: 400 },
      );
    }

    const mustHaveQuery: Record<string, unknown> = {
      groupId,
      status: "approved",
    };
    const mustHaveDocs = await MustHave.find(mustHaveQuery as never).lean();

    let targetDocs: Array<{
      _id: mongoose.Types.ObjectId;
      title: string;
      description?: string;
      startTime: Date;
      endTime: Date;
      location?: string;
      eventType?: string;
      timezone?: string;
      source?: string;
    }>;

    if (data.eventIds && data.eventIds.length > 0) {
      const invalid = data.eventIds.filter(
        (id) => !mongoose.Types.ObjectId.isValid(id),
      );
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "Invalid event id(s)", invalid },
          { status: 400 },
        );
      }
      const found = await CalendarEvent.find({
        groupId,
        _id: { $in: data.eventIds },
      })
        .sort({ startTime: 1 })
        .lean();

      if (found.length !== data.eventIds.length) {
        return NextResponse.json(
          { error: "One or more events not found in this group" },
          { status: 400 },
        );
      }
      const lockedEvents = found.filter(
        (e) => (e as { isLocked?: boolean }).isLocked,
      );
      const unlocked = found.filter(
        (e) => !(e as { isLocked?: boolean }).isLocked,
      );

      if (unlocked.length === 0) {
        return NextResponse.json(
          {
            error: "All selected events are locked and cannot be regenerated.",
          },
          { status: 400 },
        );
      }

      targetDocs = unlocked as typeof targetDocs;
    } else {
      const { from, to } = data.dateRange!;
      if (to <= from) {
        return NextResponse.json(
          { error: "dateRange.to must be after dateRange.from" },
          { status: 400 },
        );
      }
      const q: Record<string, unknown> = {
        groupId,
        startTime: { $lt: to },
        endTime: { $gt: from },
        isLocked: { $ne: true },
      };
      if (data.eventType) {
        q.eventType = data.eventType;
      }
      targetDocs = (await CalendarEvent.find(q)
        .sort({ startTime: 1 })
        .lean()) as typeof targetDocs;
      if (targetDocs.length === 0) {
        return NextResponse.json(
          { error: "No events match the given filters" },
          { status: 400 },
        );
      }
    }

    const tripCtx = mapTripToGenerationContext({
      ...(trip as Record<string, unknown>),
      fromDate: new Date((trip as { fromDate: Date }).fromDate),
      toDate: new Date((trip as { toDate: Date }).toDate),
    }) satisfies GeneratePartialItineraryInput["trip"];

    const approvedMustHaves: GeneratePartialItineraryInput["approvedMustHaves"] =
      mustHaveDocs.map((m) => ({
        name: m.name,
        address: m.address ?? undefined,
        category: m.category ?? undefined,
        notes: m.notes ?? undefined,
        placeId: typeof m.placeId === "string" ? m.placeId : undefined,
      }));

    const targetEvents: GeneratePartialItineraryInput["targetEvents"] =
      targetDocs.map((e) => ({
        title: e.title,
        description: e.description,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
        location: e.location,
        eventType: e.eventType,
      }));

    let proposed = await generatePartialItinerary({
      trip: tripCtx,
      approvedMustHaves,
      targetEvents,
    });
    proposed = normalizeProposedTimeline(proposed, {
      trip: tripCtx,
      slice: true,
    });
    proposed = filterProposedEventsByAvoidLists(
      proposed,
      tripCtx.avoidActivities ?? [],
      tripCtx.avoidLocations ?? [],
      approvedMustHaves,
    );
    let linkRows = await resolveActivityLinksForProposals(
      proposed,
      approvedMustHaves,
    );
    linkRows = await augmentResolvedLinksWithTextSearch(proposed, linkRows, {
      toCity: tripCtx.toCity,
      fromCity: tripCtx.fromCity,
    });
    const accessibilityFiltered = await filterProposedEventsByAccessibility(
      proposed,
      linkRows,
      tripCtx.accessibilityRequirements,
    );
    proposed = accessibilityFiltered.proposed;

    if (proposed.length === 0) {
      return NextResponse.json(
        {
          error:
            "No matching venues were found for the selected accessibility requirements. Try relaxing filters in trip preferences.",
          removedByAccessibility: accessibilityFiltered.removedCount,
        },
        { status: 404 },
      );
    }

    const originals = targetDocs.map(serializeEvent);
    const proposedSerialized = proposed.map((p) => serializeProposed(p));

    return NextResponse.json(
      {
        originals,
        proposed: proposedSerialized,
        removedByAccessibility: accessibilityFiltered.removedCount,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    console.error("POST itinerary/regenerate error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 },
    );
  }
}

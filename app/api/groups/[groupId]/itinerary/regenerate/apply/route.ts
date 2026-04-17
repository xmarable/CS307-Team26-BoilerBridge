import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import CalendarEvent from "@/models/CalendarEvent";
import ItineraryOptionVote from "@/models/ItineraryOptionVote";
import MustHave from "@/models/MustHave";
import Trip from "@/models/Trip";
import { ProposedEventSchema } from "@/lib/itinerary/schemas";
import { mapTripToGenerationContext } from "@/lib/itinerary/mapTripToGenerationContext";
import { normalizeProposedTimeline } from "@/lib/itinerary/normalizeProposedTimeline";
import { resolveActivityLinksForProposals } from "@/lib/itinerary/resolveActivityLinks";
import { augmentResolvedLinksWithTextSearch } from "@/lib/itinerary/augmentResolvedLinksWithTextSearch";
import { assignOptionGroupIds } from "@/lib/itinerary/clusterOptionGroups";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";

const ApplyBodySchema = z.object({
  replaceEventIds: z.array(z.string().min(1)).min(1),
  proposedEvents: z.array(ProposedEventSchema).min(1),
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
    const body = await req.json();
    const parsed = ApplyBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { replaceEventIds } = parsed.data;
    let { proposedEvents } = parsed.data;

    const invalidIds = replaceEventIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Invalid event id(s)", invalidIds },
        { status: 400 },
      );
    }

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
        { error: "Forbidden: insufficient permissions to apply itinerary changes" },
        { status: 403 },
      );
    }

    const tripDoc = await Trip.findOne({ groupID: groupId }).sort({ createdAt: -1 }).lean();
    const tripCtx = tripDoc
      ? mapTripToGenerationContext({
          ...(tripDoc as Record<string, unknown>),
          fromDate: new Date((tripDoc as { fromDate: Date }).fromDate),
          toDate: new Date((tripDoc as { toDate: Date }).toDate),
        })
      : undefined;

    const mustHaveDocs = await MustHave.find({
      groupId: groupId as never,
      status: "approved",
    } as never)
      .sort({ priority: -1 })
      .lean();
    const mustHaveForLinks = mustHaveDocs.map((m) => ({
      name: String((m as { name: string }).name),
      placeId:
        typeof (m as { placeId?: string }).placeId === "string"
          ? (m as { placeId?: string }).placeId
          : undefined,
      address: (m as { address?: string }).address,
    }));

    proposedEvents = normalizeProposedTimeline(
      proposedEvents,
      tripCtx ? { trip: tripCtx, slice: true } : undefined,
    );
    let linkRows = await resolveActivityLinksForProposals(proposedEvents, mustHaveForLinks);
    linkRows = await augmentResolvedLinksWithTextSearch(
      proposedEvents,
      linkRows,
      tripCtx
        ? { toCity: tripCtx.toCity, fromCity: tripCtx.fromCity }
        : null,
    );

    const destCity = tripCtx?.toCity?.trim() ?? "";

    for (const ev of proposedEvents) {
      if (ev.endTime <= ev.startTime) {
        return NextResponse.json(
          { error: "Each proposed event must have endTime after startTime" },
          { status: 400 },
        );
      }
    }

    const existing = await CalendarEvent.find({
      _id: { $in: replaceEventIds },
      groupId,
    }).lean();

    if (existing.length !== replaceEventIds.length) {
      return NextResponse.json(
        { error: "One or more events to replace were not found in this group" },
        { status: 400 },
      );
    }

    const touchedGroupIds = [
      ...new Set(
        existing
          .map((e) => (e as { optionGroupId?: string }).optionGroupId)
          .filter((g): g is string => typeof g === "string" && g.length > 0),
      ),
    ];
    if (touchedGroupIds.length > 0) {
      await ItineraryOptionVote.deleteMany({
        groupId,
        optionGroupId: { $in: touchedGroupIds },
      } as never);
    }

    const del = await CalendarEvent.deleteMany({
      _id: { $in: replaceEventIds },
      groupId,
    });
    if (del.deletedCount !== replaceEventIds.length) {
      return NextResponse.json(
        { error: "Could not remove all events to replace; none were modified." },
        { status: 409 },
      );
    }

    const optionGroupIds = assignOptionGroupIds(proposedEvents as ProposedEventInput[]);

    const docs = proposedEvents.map((ev, i) => ({
      title: ev.title,
      description: ev.description,
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: linkRows[i]?.linkedLocationHint?.trim() || ev.location,
      eventType: ev.eventType ?? "general",
      createdBy: userId,
      groupId,
      source: "itinerary" as const,
      timezone: ev.timezone ?? "UTC",
      itineraryOptionStatus: "candidate" as const,
      ...(optionGroupIds[i] ? { optionGroupId: optionGroupIds[i] } : {}),
      ...(destCity ? { itineraryDestinationCity: destCity } : {}),
      ...(linkRows[i]?.linkedActivityId
        ? { linkedActivityId: linkRows[i]!.linkedActivityId }
        : {}),
      ...(linkRows[i]?.linkedPlaceId ? { linkedPlaceId: linkRows[i]!.linkedPlaceId } : {}),
    }));

    const inserted = await CalendarEvent.insertMany(docs);

    return NextResponse.json({ events: inserted }, { status: 200 });
  } catch (err: unknown) {
    console.error("POST itinerary/regenerate/apply error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import {
  generateFullTripEvents,
  type MustHaveContext,
} from "@/lib/itinerary/generateFull";
import { mapTripToGenerationContext } from "@/lib/itinerary/mapTripToGenerationContext";
import { normalizeProposedTimeline } from "@/lib/itinerary/normalizeProposedTimeline";
import { filterProposedEventsByAvoidLists } from "@/lib/itinerary/filterProposedByAvoid";
import { filterProposedEventsByAccessibility } from "@/lib/itinerary/filterProposedByAccessibility";
import { resolveActivityLinksForProposals } from "@/lib/itinerary/resolveActivityLinks";
import { augmentResolvedLinksWithTextSearch } from "@/lib/itinerary/augmentResolvedLinksWithTextSearch";
import { assignOptionGroupIds } from "@/lib/itinerary/clusterOptionGroups";
import {
  getItineraryChronologyIssues,
  ItineraryValidationError,
} from "@/lib/itinerary/itineraryChronology";
import { mergeItineraryValidationIssues } from "@/lib/itinerary/itineraryDeterministic";

import CalendarEvent from "@/models/CalendarEvent";
import ItineraryOptionVote from "@/models/ItineraryOptionVote";
import MustHave from "@/models/MustHave";
import Trip from "@/models/Trip";
import { createTripNotif } from "@/lib/notifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required." },
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
        { error: "Forbidden: insufficient permissions to generate itinerary" },
        { status: 403 },
      );
    }

    let selectedTripId: string | undefined;
    try {
      const body = (await req.json()) as { tripId?: unknown };
      if (typeof body?.tripId === "string" && body.tripId.trim().length > 0) {
        selectedTripId = body.tripId.trim();
      }
    } catch {
      // Empty body is valid; fallback to latest trip for the group.
    }

    const trip = selectedTripId
      ? await Trip.findOne({
          _id: selectedTripId as never,
          groupID: groupId as never,
        }).lean()
      : await Trip.findOne({ groupID: groupId as never })
          .sort({ createdAt: -1 })
          .lean();
    if (!trip) {
      return NextResponse.json(
        {
          error: selectedTripId
            ? "The selected trip could not be found for this group."
            : "No trip is set up for this group yet. Use Trip settings next to Timeline (group page) to add route, dates, and budget, then try again.",
        },
        { status: selectedTripId ? 400 : 404 },
      );
    }

    const startDate = new Date((trip as { fromDate: Date }).fromDate);
    const endDate = new Date((trip as { toDate: Date }).toDate);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date range found in the trip configuration." },
        { status: 400 },
      );
    }

    const mustHaveDocs = await MustHave.find({
      groupId: groupId as never,
      status: "approved",
    } as never)
      .sort({ priority: -1 })
      .lean();

    const approvedMustHaves: MustHaveContext[] = mustHaveDocs.map((m) => ({
      name: String((m as { name: string }).name),
      address: (m as { address?: string }).address,
      category: (m as { category?: string }).category,
      notes: (m as { notes?: string }).notes,
      placeId:
        typeof (m as { placeId?: string }).placeId === "string"
          ? (m as { placeId?: string }).placeId
          : undefined,
    }));

    const tripCtx = mapTripToGenerationContext({
      ...(trip as Record<string, unknown>),
      fromDate: startDate,
      toDate: endDate,
    });

    let proposed;
    try {
      proposed = await generateFullTripEvents(tripCtx, approvedMustHaves);
      proposed = normalizeProposedTimeline(proposed, { trip: tripCtx });
      proposed = filterProposedEventsByAvoidLists(
        proposed,
        tripCtx.avoidActivities ?? [],
        tripCtx.avoidLocations ?? [],
        approvedMustHaves,
      );

      let issues = mergeItineraryValidationIssues(
        proposed,
        tripCtx,
        getItineraryChronologyIssues(proposed, tripCtx),
      );
      if (issues.length > 0) {
        console.warn("[itinerary] validation failed, retrying once:", issues);
        proposed = await generateFullTripEvents(tripCtx, approvedMustHaves, {
          chronologyCorrectionNote: issues.join("; "),
        });
        proposed = normalizeProposedTimeline(proposed, { trip: tripCtx });
        proposed = filterProposedEventsByAvoidLists(
          proposed,
          tripCtx.avoidActivities ?? [],
          tripCtx.avoidLocations ?? [],
          approvedMustHaves,
        );
        issues = mergeItineraryValidationIssues(
          proposed,
          tripCtx,
          getItineraryChronologyIssues(proposed, tripCtx),
        );
      }
      if (issues.length > 0) {
        console.error("[itinerary] chronology validation failed after retry:", issues);
        throw new ItineraryValidationError(issues);
      }
    } catch (e) {
      if (e instanceof ItineraryValidationError) {
        return NextResponse.json(
          {
            error:
              "Generated itinerary could not be validated for realistic times. Try again or simplify trip settings.",
            details: e.issues.join("; "),
          },
          { status: 422 },
        );
      }
      console.error("Ollama full itinerary generation:", e);
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          error: "Itinerary generation failed (Ollama).",
          details: msg,
        },
        { status: 502 },
      );
    }

    await ItineraryOptionVote.deleteMany({ groupId } as never);
    await CalendarEvent.deleteMany({
      groupId: groupId as never,
      source: "itinerary",
    } as never);

    const optionGroupIds = assignOptionGroupIds(proposed);

    let linkRows = await resolveActivityLinksForProposals(proposed, approvedMustHaves);
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
    linkRows = accessibilityFiltered.linkRows;

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

    const destCity = tripCtx.toCity?.trim() ?? "";

    const docs = proposed.map((ev, i) => ({
      title: ev.title,
      description: ev.description,
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: linkRows[i]?.linkedLocationHint?.trim() || ev.location,
      eventType: ev.eventType ?? "general",
      createdBy: userId,
      groupId,
      source: "itinerary" as const,
      accessibilityMatched: true,
      timezone: ev.timezone ?? "UTC",
      itineraryOptionStatus: "candidate" as const,
      ...(optionGroupIds[i] ? { optionGroupId: optionGroupIds[i] } : {}),
      ...(destCity ? { itineraryDestinationCity: destCity } : {}),
      ...(linkRows[i]?.linkedActivityId
        ? { linkedActivityId: linkRows[i]!.linkedActivityId }
        : {}),
      ...(linkRows[i]?.linkedPlaceId ? { linkedPlaceId: linkRows[i]!.linkedPlaceId } : {}),
    }));

    const created = await CalendarEvent.insertMany(docs);

    createTripNotif({
      groupID: groupId,
      userId: userId,
      message: `Itinerary generated for ${trip.toCity}`
    });

    return NextResponse.json({
      message: "Itinerary sparked successfully.",
      count: created.length,
      removedByAccessibility: accessibilityFiltered.removedCount,
    });
  } catch (err: unknown) {
    // i want to see why this is failing so im logging the whole err object lol
    console.error("Itinerary generation error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Internal server error during itinerary generation.",
        details: message,
      },
      { status: 500 },
    );
  }
}

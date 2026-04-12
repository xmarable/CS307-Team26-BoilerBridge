import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import Trip from "@/models/Trip";
import CalendarEvent from "@/models/CalendarEvent";
import TravelGroup from "@/models/TravelGroup";
import PublicItinerary from "@/models/PublicItinerary";
import { getMemberPermissions } from "@/lib/roles";
import {
  buildTitleFromCities,
  buildTripSnapshot,
  formatSubtitleRange,
  serializeGroupItineraryEvents,
} from "@/lib/publicItinerarySnapshot";

const publishBodySchema = z.object({
  sourceType: z.enum(["trip", "group"]),
  sourceId: z.string().min(1, "sourceId is required"),
});

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const parsed = publishBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 },
      );
    }

    const { sourceType, sourceId } = parsed.data;

    if (sourceType === "trip") {
      if (!mongoose.Types.ObjectId.isValid(sourceId)) {
        return NextResponse.json({ error: "Invalid trip id" }, { status: 400 });
      }
      const trip = await Trip.findById(sourceId).lean();
      if (!trip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      if (String((trip as { userId: unknown }).userId) !== String(userId)) {
        return NextResponse.json(
          { error: "Forbidden: only the trip creator can publish this itinerary" },
          { status: 403 },
        );
      }
      const primary = (trip as { primaryItinerary?: unknown[] }).primaryItinerary ?? [];
      if (!Array.isArray(primary) || primary.length === 0) {
        return NextResponse.json(
          { error: "Nothing to publish: add activities to your primary itinerary first." },
          { status: 400 },
        );
      }
      const snap = buildTripSnapshot(trip as Parameters<typeof buildTripSnapshot>[0]);
      const title = buildTitleFromCities(
        String((trip as { fromCity: string }).fromCity),
        String((trip as { toCity: string }).toCity),
      );
      const subtitle = formatSubtitleRange(
        new Date((trip as { fromDate: Date }).fromDate),
        new Date((trip as { toDate: Date }).toDate),
      );

      const doc = await PublicItinerary.findOneAndUpdate(
        { sourceType: "trip", sourceId },
        {
          $set: {
            ownerId: userId,
            isPublic: true,
            publishedAt: new Date(),
            title,
            subtitle,
            snapshot: snap,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      return NextResponse.json(
        {
          message: "Published",
          publicItineraryId: doc!._id.toString(),
          sourceType: "trip",
          sourceId,
        },
        { status: 201 },
      );
    }

    // group
    const uuid = z.string().uuid().safeParse(sourceId);
    if (!uuid.success) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
    }

    const perm = await getMemberPermissions(sourceId, userId);
    if ("error" in perm && perm.error) {
      return NextResponse.json(
        { error: perm.error },
        { status: perm.status ?? 403 },
      );
    }
    if (!perm.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: only Leaders and Admins can publish the group itinerary" },
        { status: 403 },
      );
    }

    const itineraryEvents = await CalendarEvent.find({
      groupId: sourceId as never,
      source: "itinerary",
    } as never)
      .sort({ startTime: 1 })
      .lean();

    if (!itineraryEvents.length) {
      return NextResponse.json(
        {
          error:
            "Nothing to publish: generate a group itinerary (spark) first, or no itinerary events exist.",
        },
        { status: 400 },
      );
    }

    const group = await TravelGroup.findOne({ groupID: sourceId }).lean();
    const trip = await Trip.findOne({ groupID: sourceId as never })
      .sort({ createdAt: -1 })
      .lean();

    const snapEvents = serializeGroupItineraryEvents(
      itineraryEvents as Record<string, unknown>[],
    );
    const fromCity = trip ? String((trip as { fromCity: string }).fromCity) : "";
    const toCity = trip ? String((trip as { toCity: string }).toCity) : "";
    const title =
      fromCity && toCity
        ? buildTitleFromCities(fromCity, toCity)
        : group
          ? String((group as { groupName: string }).groupName)
          : "Group itinerary";
    let subtitle = "";
    if (trip) {
      subtitle = formatSubtitleRange(
        new Date((trip as { fromDate: Date }).fromDate),
        new Date((trip as { toDate: Date }).toDate),
      );
    }

    const doc = await PublicItinerary.findOneAndUpdate(
      { sourceType: "group", sourceId },
      {
        $set: {
          ownerId: userId,
          isPublic: true,
          publishedAt: new Date(),
          title,
          subtitle,
          snapshot: {
            groupEvents: snapEvents,
            fromCity: fromCity || undefined,
            toCity: toCity || undefined,
            fromDate: trip ? (trip as { fromDate: Date }).fromDate : undefined,
            toDate: trip ? (trip as { toDate: Date }).toDate : undefined,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return NextResponse.json(
      {
        message: "Published",
        publicItineraryId: doc!._id.toString(),
        sourceType: "group",
        sourceId,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("POST /api/itineraries/publish:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import {
  generateFullTripEvents,
  type MustHaveContext,
  type TripContext,
} from "@/lib/itinerary/generateFull";

import CalendarEvent from "@/models/CalendarEvent";
import MustHave from "@/models/MustHave";
import Trip from "@/models/Trip";

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

    const trip = await Trip.findOne({ groupID: groupId as never })
      .sort({ createdAt: -1 })
      .lean();
    if (!trip) {
      return NextResponse.json(
        {
          error:
            "No trip is set up for this group yet. Use Trip settings next to Timeline (group page) to add route, dates, and budget, then try again.",
        },
        { status: 404 },
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
    }));

    if (approvedMustHaves.length === 0) {
      return NextResponse.json(
        {
          error:
            "No approved must-haves to build an itinerary from. Approve at least one must-have first.",
        },
        { status: 400 },
      );
    }

    const tripCtx: TripContext = {
      fromCity: String((trip as { fromCity: string }).fromCity),
      toCity: String((trip as { toCity: string }).toCity),
      fromDate: startDate,
      toDate: endDate,
      mode: String((trip as { mode: string }).mode),
      budget: Number((trip as { budget: number }).budget),
    };

    let proposed;
    try {
      proposed = await generateFullTripEvents(tripCtx, approvedMustHaves);
    } catch (e) {
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

    await CalendarEvent.deleteMany({
      groupId: groupId as never,
      source: "itinerary",
    } as never);

    const docs = proposed.map((ev) => ({
      title: ev.title,
      description: ev.description,
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: ev.location,
      eventType: ev.eventType ?? "general",
      createdBy: userId,
      groupId,
      source: "itinerary" as const,
      timezone: ev.timezone ?? "UTC",
    }));

    const created = await CalendarEvent.insertMany(docs);

    return NextResponse.json({
      message: "Itinerary sparked successfully.",
      count: created.length,
    });
  } catch (err: unknown) {
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

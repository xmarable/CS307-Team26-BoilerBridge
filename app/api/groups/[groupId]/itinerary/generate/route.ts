import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import CalendarEvent from "@/models/CalendarEvent";
import MustHave from "@/models/MustHave";
import Trip from "@/models/Trip";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();

    const { groupId } = await params;

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required." },
        { status: 400 },
      );
    }

    // 1. Fetch trip details
    // using 'as any' on the query object satisfies the UUID/string type mismatch
    const trip = await Trip.findOne({ groupID: groupId as any });
    if (!trip) {
      return NextResponse.json(
        { error: "Trip settings not found for the provided Group ID." },
        { status: 404 },
      );
    }

    // 2. Validate trip dates
    const startDate = new Date(trip.fromDate);
    const endDate = new Date(trip.toDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date range found in the trip configuration." },
        { status: 400 },
      );
    }

    // 3. Fetch approved must-haves
    const approvedMustHaves = await MustHave.find({
      groupId: groupId as any,
      status: "approved",
    }).sort({ priority: -1 });

    if (approvedMustHaves.length === 0) {
      return NextResponse.json(
        { error: "No approved items available to generate an itinerary." },
        { status: 400 },
      );
    }

    // 4. Clear existing generated itinerary events
    await CalendarEvent.deleteMany({
      groupId: groupId as any,
      source: "itinerary",
    });

    // 5. Distribution logic
    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) || 1;
    const generatedEvents: any[] = [];

    approvedMustHaves.forEach((mh, index) => {
      const dayOffset = Math.floor(index / 3) % totalDays;
      const slot = index % 3;

      const eventStart = new Date(startDate);
      eventStart.setDate(startDate.getDate() + dayOffset);

      const hour = slot === 0 ? 10 : slot === 1 ? 14 : 18;
      eventStart.setHours(hour, 0, 0, 0);

      const eventEnd = new Date(eventStart);
      eventEnd.setHours(eventStart.getHours() + 2);

      generatedEvents.push({
        title: mh.name,
        description: mh.notes || "",
        location: mh.address || "",
        startTime: eventStart,
        endTime: eventEnd,
        groupId: groupId,
        createdBy: mh.addedBy,
        source: "itinerary",
        eventType: mh.category || "activity",
      });
    });

    // 6. Batch insert generated events
    const created = await CalendarEvent.insertMany(generatedEvents);

    return NextResponse.json({
      message: "Itinerary sparked successfully.",
      count: created.length,
    });
  } catch (err: any) {
    console.error("Itinerary generation error:", err);
    return NextResponse.json(
      {
        error: "Internal server error during itinerary generation.",
        details: err.message,
      },
      { status: 500 },
    );
  }
}

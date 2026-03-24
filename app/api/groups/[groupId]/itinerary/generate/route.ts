import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import CalendarEvent from "@/models/CalendarEvent";
import MustHave from "@/models/MustHave";
import Trip from "@/models/Trip";

export async function POST(
  req: Request,
  { params }: { params: { groupId: string } },
) {
  try {
    await dbConnect();
    const { groupId } = await params;

    // 1. fetch trip details
    const trip = await Trip.findOne({ groupId: groupId as any });
    if (!trip) {
      return NextResponse.json(
        {
          error:
            "Trip settings not found. Please ensure the Group ID exists in the Trip document.",
        },
        { status: 404 },
      );
    }

    // 2. validate dates from the trip doc to prevent 'Invalid Date' errors
    const startDate = new Date(trip.fromDate);
    const endDate = new Date(trip.toDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        {
          error:
            "Trip dates in the database are invalid. Please check the MongoDB document.",
        },
        { status: 400 },
      );
    }

    // 3. fetch approved must-haves
    const approvedMustHaves = await MustHave.find({
      groupId: groupId as any,
      status: "approved",
    }).sort({ priority: -1 });

    if (approvedMustHaves.length === 0) {
      return NextResponse.json(
        { error: "No approved must-haves found. Please approve items first." },
        { status: 400 },
      );
    }

    // 4. wipe existing generated events
    await CalendarEvent.deleteMany({
      groupId: groupId as any,
      source: "itinerary",
    });

    // 5. distribution logic
    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) || 1;
    const generatedEvents: any[] = [];

    approvedMustHaves.forEach((mh, index) => {
      // logic to spread across days and slots (10am, 2pm, 6pm)
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

    // 6. batch insert into the timeline
    const created = await CalendarEvent.insertMany(generatedEvents);
    if (created) {
      return NextResponse.json({
        message: "Itinerary sparked successfully.",
        count: created.length,
      });
    }

    return NextResponse.json({
      message: "Itinerary sparked successfully.",
      count: generatedEvents.length,
    });
  } catch (err: any) {
    console.error("Generation error:", err);
    return NextResponse.json(
      {
        error: "Internal server error during generation.",
        details: err.message,
      },
      { status: 500 },
    );
  }
}

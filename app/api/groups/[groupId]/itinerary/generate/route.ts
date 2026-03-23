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

    // 1. fetch trip details to get date range
    // using as any to bypass strict UUID string mismatch in query
    const trip = await Trip.findOne({ groupId: groupId as any });
    if (!trip) {
      return NextResponse.json(
        { error: "trip settings not found" },
        { status: 404 },
      );
    }

    // 2. fetch approved must-haves
    // baseline picks only 'approved' items to respect group decisions
    const approvedMustHaves = await MustHave.find({
      groupId: groupId as any,
      status: "approved",
    }).sort({ priority: -1 });

    if (approvedMustHaves.length === 0) {
      return NextResponse.json(
        {
          error:
            "no approved must-haves found lol propose and approve some first",
        },
        { status: 400 },
      );
    }

    // 3. wipe existing generated events (keep manual ones)
    // story #21: this allows clean regeneration of the timeline
    await CalendarEvent.deleteMany({
      groupId: groupId as any,
      source: "itinerary",
    });

    // 4. distribution logic (baseline)
    const startDate = new Date(trip.startDate);
    const endDate = new Date(trip.endDate);
    const totalDays =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) || 1;

    // typed array to avoid ts errors in insertMany
    const generatedEvents: any[] = [];

    approvedMustHaves.forEach((mh, index) => {
      const dayOffset = Math.floor(index / 3) % totalDays;
      const slot = index % 3; // morning, afternoon, evening slots

      const eventStart = new Date(startDate);
      eventStart.setDate(startDate.getDate() + dayOffset);

      // baseline time slots: 10am, 2pm, 6pm
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
        createdBy: mh.addedBy, // keep original proposer as creator
        source: "itinerary",
        eventType: mh.category || "activity",
      });
    });

    const created = await CalendarEvent.insertMany(generatedEvents);

    return NextResponse.json({
      message: "itinerary sparked lol",
      count: created.length,
    });
  } catch (err: any) {
    console.error("gen error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

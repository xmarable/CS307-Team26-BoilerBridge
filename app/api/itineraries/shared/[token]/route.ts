import dbConnect from "@/lib/dbConnect";
import { buildTitleFromCities, buildTripSnapshot, formatSubtitleRange, serializeGroupItineraryEvents } from "@/lib/publicItinerarySnapshot";
import CalendarEvent from "@/models/CalendarEvent";
import SharedItineraryLink from "@/models/SharedItineraryLink";
import TravelGroup from "@/models/TravelGroup";
import Trip from "@/models/Trip";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    await dbConnect();

    const { token } = await params;
    const shared = await SharedItineraryLink.findOne(({
        token: token,
        isActive: true,
    }));

    if (!shared) {
        return NextResponse.json({ error: "Shared Not found" }, { status: 404 });
    }
    
    const group = await TravelGroup.findOne({ groupID: shared.groupId })
    const trip = await Trip.findOne({ tripId: shared.tripId });
    if (!group) {
        return NextResponse.json({ error: "Group Not found" }, { status: 404 });
    }
    if (!trip) {
        return NextResponse.json({ error: "Trip Not found" }, { status: 404 });
    }

    const itineraryEvents = await CalendarEvent.find({
        groupId: group.groupID,
        source: "itinerary"
    })
    const snapEvents = serializeGroupItineraryEvents(itineraryEvents as unknown as Record<string, unknown>[]);
    const title = 
        trip.fromCity && trip.toCity
            ? buildTitleFromCities(trip.fromCity, trip.toCity)
            : group
                ? group.groupName
                : "Group itinerary";
    const subtitle = formatSubtitleRange(
        new Date(trip.fromDate),
        new Date(trip.toDate)
    );

    return NextResponse.json({
        title,
        subtitle,
        snapshot: {
            primaryItinerary: trip.primaryItinerary,
            rainyDayItinerary: trip.rainyDayItinerary,
            groupEvents: snapEvents,
            fromCity: trip.fromCity,
            toCity: trip.toCity,
            fromDate: trip.fromDate,
            toDate: trip.toDate
        }
    }, { status: 200 });
}
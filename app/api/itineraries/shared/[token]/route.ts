import dbConnect from "@/lib/dbConnect";
import { buildTripSnapshot } from "@/lib/publicItinerarySnapshot";
import SharedItineraryLink from "@/models/SharedItineraryLink";
import Trip from "@/models/Trip";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    await dbConnect();

    const { token } = await params;
    console.log(token);
    const shared = await SharedItineraryLink.findOne(({
        token: token,
        isActive: true,
    }));

    if (!shared) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const trip = await Trip.findOne({ tripId: shared.tripId });
    if (!trip) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
        snapshot: buildTripSnapshot(trip)
    }, { status: 200 });
}
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Trip from "@/models/Trip";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await context.params;
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // AC Logic: Verify permissions using the groupID linked to the trip
    // Type casting to 'any' here solves the union property access issue while maintaining logic
    const permissionResult = await getMemberPermissions(trip.groupID, userId) as any;
    
    if (permissionResult.error) {
      return NextResponse.json({ error: permissionResult.error }, { status: permissionResult.status });
    }

    // AC: Given a member is a 'Viewer', When they attempt to edit the itinerary, Then the API blocks the request.
    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: Viewers cannot edit group itineraries" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const updatedTrip = await Trip.findByIdAndUpdate(tripId, body, { new: true });

    return NextResponse.json(updatedTrip, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/trip/[tripId] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await context.params;
    await dbConnect();

    const session = await getServerSession(authOptions);
    const userId = session?.user?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const permissionResult = await getMemberPermissions(trip.groupID, userId) as any;
    
    if (permissionResult.error) {
      return NextResponse.json({ error: permissionResult.error }, { status: permissionResult.status });
    }

    if (!permissionResult.canEdit) {
      return NextResponse.json({ error: "Viewers cannot delete items" }, { status: 403 });
    }

    await Trip.findByIdAndDelete(tripId);
    return NextResponse.json({ message: "Trip deleted" }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/trip/[tripId] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
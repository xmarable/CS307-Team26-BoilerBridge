import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import ItineraryStop from "@/models/ItineraryStop";

function getSessionUserIds(session: any): string[] {
  return [session?.user?.userId, session?.user?.id].filter(Boolean);
}

function isGroupMember(group: any, userIds: string[]) {
  if (!Array.isArray(group?.membersList)) return false;
  return (
    group.membersList.some((m: any) => userIds.includes(m.userId?.toString())) ||
    userIds.includes(group?.leaderID?.toString())
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userIds = getSessionUserIds(session);
    if (!userIds.length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { groupId } = await context.params;

    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (!isGroupMember(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const tripId = searchParams.get("tripId");

    const query: Record<string, any> = { groupId };
    if (tripId) query.tripId = tripId;

    const stops = await ItineraryStop.find(query).sort({ order: 1 }).lean();

    const mapped = stops.map((s) => ({
      ...s,
      hasCoordinates: typeof s.lat === "number" && typeof s.lng === "number",
    }));

    return NextResponse.json({ stops: mapped }, { status: 200 });
  } catch (err: any) {
    console.error("GET itinerary/map error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userIds = getSessionUserIds(session);
    if (!userIds.length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { groupId } = await context.params;

    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (!isGroupMember(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { title, placeName, address, lat, lng, order, startTime, endTime, notes, tripId, calendarEventId } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (typeof order !== "number") {
      return NextResponse.json({ error: "order must be a number" }, { status: 400 });
    }
    if (lat !== undefined && (typeof lat !== "number" || lat < -90 || lat > 90)) {
      return NextResponse.json({ error: "lat must be between -90 and 90" }, { status: 400 });
    }
    if (lng !== undefined && (typeof lng !== "number" || lng < -180 || lng > 180)) {
      return NextResponse.json({ error: "lng must be between -180 and 180" }, { status: 400 });
    }

    const stop = await ItineraryStop.create({
      groupId,
      tripId,
      calendarEventId,
      title: title.trim(),
      placeName,
      address,
      lat,
      lng,
      order,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      notes,
      createdBy: userIds[0],
    });

    return NextResponse.json({ stop }, { status: 201 });
  } catch (err: any) {
    console.error("POST itinerary/map error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

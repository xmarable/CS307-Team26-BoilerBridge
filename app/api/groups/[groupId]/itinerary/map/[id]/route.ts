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

function isGroupAdmin(group: any, userIds: string[]) {
  if (userIds.includes(group?.leaderID?.toString())) return true;
  if (!Array.isArray(group?.membersList)) return false;
  return group.membersList.some(
    (m: any) => userIds.includes(m.userId?.toString()) && m.role !== "Viewer",
  );
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ groupId: string; id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userIds = getSessionUserIds(session);
    if (!userIds.length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { groupId, id } = await context.params;

    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (!isGroupMember(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stop = await ItineraryStop.findOne({ _id: id, groupId });
    if (!stop) {
      return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    }

    const isCreator = userIds.includes(stop.createdBy?.toString());
    if (!isCreator && !isGroupAdmin(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const allowed = ["title", "placeName", "address", "lat", "lng", "order", "startTime", "endTime", "notes", "tripId", "calendarEventId"];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        (stop as any)[key] = body[key];
      }
    }

    if (body.lat !== undefined && (typeof body.lat !== "number" || body.lat < -90 || body.lat > 90)) {
      return NextResponse.json({ error: "lat must be between -90 and 90" }, { status: 400 });
    }
    if (body.lng !== undefined && (typeof body.lng !== "number" || body.lng < -180 || body.lng > 180)) {
      return NextResponse.json({ error: "lng must be between -180 and 180" }, { status: 400 });
    }

    await stop.save();
    return NextResponse.json({ stop }, { status: 200 });
  } catch (err: any) {
    console.error("PUT itinerary/map/:id error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ groupId: string; id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userIds = getSessionUserIds(session);
    if (!userIds.length) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { groupId, id } = await context.params;

    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (!isGroupMember(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const stop = await ItineraryStop.findOne({ _id: id, groupId });
    if (!stop) {
      return NextResponse.json({ error: "Stop not found" }, { status: 404 });
    }

    const isCreator = userIds.includes(stop.createdBy?.toString());
    if (!isCreator && !isGroupAdmin(group, userIds)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await stop.deleteOne();
    return NextResponse.json({ message: "Stop deleted" }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE itinerary/map/:id error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

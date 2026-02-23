import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

import User from "@/models/User";
import TravelGroup from "@/models/TravelGroup";
import CalendarEvent from "@/models/CalendarEvent";

async function getUserIdentifiers() {
  const session = await getServerSession(authOptions);
  const mongoId = (session?.user as any)?.id as string | undefined;
  if (!mongoId) return null;

  await dbConnect();
  const userDoc: any = await User.findById(mongoId).lean();

  return {
    mongoId,
    uuid: userDoc?.userId as string | undefined,
  };
}

function isMember(group: any, ids: { mongoId: string; uuid?: string }) {
  const members: string[] = group?.members ?? [];
  return members.includes(ids.mongoId) || (ids.uuid ? members.includes(ids.uuid) : false);
}

function isAdmin(group: any, ids: { mongoId: string; uuid?: string }) {
  const admins: string[] = group?.admins ?? [];
  return admins.includes(ids.mongoId) || (ids.uuid ? admins.includes(ids.uuid) : false);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { groupId: string; eventId: string } }
) {
  try {
    const ids = await getUserIdentifiers();
    if (!ids) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, eventId } = params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }

    await dbConnect();

    const group: any = await TravelGroup.findOne({ groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isMember(group, ids)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const event: any = await CalendarEvent.findOne({ _id: eventId, groupId });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Allow delete if creator OR admin
    const creatorMatches =
      event.createdBy === ids.mongoId || (ids.uuid ? event.createdBy === ids.uuid : false);

    if (!creatorMatches && !isAdmin(group, ids)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await CalendarEvent.deleteOne({ _id: eventId, groupId });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE /api/groups/:groupId/calendar/events/:eventId error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
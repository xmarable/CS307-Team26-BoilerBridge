import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import mongoose from "mongoose";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

import TravelGroup from "@/models/TravelGroup";
import CalendarEvent from "@/models/CalendarEvent";

function isMemberOrLeader(group: any, userMongoId: string) {
  const leader = group?.leaderID?.toString() === userMongoId;
  const member =
    Array.isArray(group?.membersList) &&
    group.membersList.some((id: any) => id?.toString() === userMongoId);
  return leader || member;
}

function isLeader(group: any, userMongoId: string) {
  return group?.leaderID?.toString() === userMongoId;
}

const UpdateEventSchema = z.object({
  title: z.string().min(1, "Title cannot be empty").optional(),
  description: z.string().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  location: z.string().optional(),
  eventType: z.string().optional(),
  timezone: z.string().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { groupId: string; eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userMongoId = (session?.user as any)?.id as string | undefined;
    if (!userMongoId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, eventId } = params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }

    await dbConnect();

    const group: any = await TravelGroup.findById(groupId).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isMemberOrLeader(group, userMongoId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const event: any = await CalendarEvent.findOne({ _id: eventId, groupId });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Creator OR leader can edit
    const creator = event.createdBy === userMongoId;
    const leader = isLeader(group, userMongoId);
    if (!creator && !leader) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates = parsed.data;

    if (updates.title !== undefined) event.title = updates.title;
    if (updates.description !== undefined) event.description = updates.description;
    if (updates.location !== undefined) event.location = updates.location;
    if (updates.eventType !== undefined) event.eventType = updates.eventType;
    if (updates.timezone !== undefined) event.timezone = updates.timezone;

    if (updates.startTime !== undefined) event.startTime = updates.startTime;
    if (updates.endTime !== undefined) event.endTime = updates.endTime;

    if (event.endTime <= event.startTime) {
      return NextResponse.json(
        { error: "Invalid time range: endTime must be after startTime" },
        { status: 400 }
      );
    }

    await event.save();

    return NextResponse.json({ event }, { status: 200 });
  } catch (err: any) {
    console.error("PUT calendar event error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { groupId: string; eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const userMongoId = (session?.user as any)?.id as string | undefined;
    if (!userMongoId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, eventId } = params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }

    await dbConnect();

    const group: any = await TravelGroup.findById(groupId).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isMemberOrLeader(group, userMongoId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const event: any = await CalendarEvent.findOne({ _id: eventId, groupId });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Creator OR leader can delete
    const creator = event.createdBy === userMongoId;
    const leader = isLeader(group, userMongoId);
    if (!creator && !leader) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await CalendarEvent.deleteOne({ _id: eventId, groupId });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE calendar event error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
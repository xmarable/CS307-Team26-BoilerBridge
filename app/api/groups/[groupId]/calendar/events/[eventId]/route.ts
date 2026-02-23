/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
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

function isCreator(event: any, ids: { mongoId: string; uuid?: string }) {
  return (
    event.createdBy === ids.mongoId ||
    (ids.uuid ? event.createdBy === ids.uuid : false)
  );
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
  { params }: { params: Promise<{ groupId: string; eventId: string }> }
) {
  try {
    const ids = await getUserIdentifiers();
    if (!ids) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, eventId } = await params;

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

    // Only creator OR admin can edit
    if (!isCreator(event, ids) && !isAdmin(group, ids)) {
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

    // Apply updates (only if provided)
    if (updates.title !== undefined) event.title = updates.title;
    if (updates.description !== undefined) event.description = updates.description;
    if (updates.location !== undefined) event.location = updates.location;
    if (updates.eventType !== undefined) event.eventType = updates.eventType;
    if (updates.timezone !== undefined) event.timezone = updates.timezone;

    if (updates.startTime !== undefined) event.startTime = updates.startTime;
    if (updates.endTime !== undefined) event.endTime = updates.endTime;

    // Validate final time range if either changed (or both)
    if (event.endTime <= event.startTime) {
      return NextResponse.json(
        { error: "Invalid time range: endTime must be after startTime" },
        { status: 400 }
      );
    }

    await event.save();

    return NextResponse.json({ event }, { status: 200 });
  } 
  catch (err: any) {
    console.error("PUT /api/groups/:groupId/calendar/events/:eventId error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; eventId: string }> }
) {
  try {
    const ids = await getUserIdentifiers();
    if (!ids) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, eventId } = await params;

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

    // Only creator OR admin can delete
    if (!isCreator(event, ids) && !isAdmin(group, ids)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await CalendarEvent.deleteOne({ _id: eventId, groupId });

    return NextResponse.json({ ok: true }, { status: 200 });
  } 
  catch (err: any) {
    console.error("DELETE /api/groups/:groupId/calendar/events/:eventId error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import mongoose from "mongoose";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

import TravelGroup from "@/models/TravelGroup";
import CalendarEvent from "@/models/CalendarEvent";
import { findCalendarEventOverlap } from "@/lib/calendar/findCalendarEventOverlap";
import { getMemberPermissions } from "@/lib/roles";

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
  { params }: { params: Promise<{ groupId: string; eventId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, eventId } = await params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }

    await dbConnect();

    // 1. use the helper for consistent role logic
    const perms = await getMemberPermissions(groupId, userId);
    if ("error" in perms && perms.error) {
      return NextResponse.json(
        { error: perms.error },
        { status: perms.status },
      );
    }

    const event: any = await CalendarEvent.findOne({ _id: eventId, groupId });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // 2. authorize: creator OR anyone with canEdit (Leader/Admin)
    const isAuthorized = String(event.createdBy) === userId || perms.canEdit;
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updates = parsed.data;
    const group = perms.group; // helper already fetched the full doc

    const timeChanged =
      updates.startTime !== undefined &&
      new Date(updates.startTime).getTime() !==
        new Date(event.startTime).getTime();

    const nextStart =
      updates.startTime !== undefined
        ? new Date(updates.startTime)
        : new Date(event.startTime);
    const nextEnd =
      updates.endTime !== undefined
        ? new Date(updates.endTime)
        : new Date(event.endTime);

    if (nextEnd <= nextStart) {
      return NextResponse.json(
        { error: "Invalid time range: endTime must be after startTime" },
        { status: 400 },
      );
    }

    const overlap = await findCalendarEventOverlap(
      groupId,
      { start: nextStart, end: nextEnd },
      eventId,
    );
    if (overlap) {
      return NextResponse.json(
        {
          error: "That time overlaps another activity in the timeline.",
          conflictWith: {
            title: overlap.title,
            startTime: overlap.startTime.toISOString(),
            endTime: overlap.endTime.toISOString(),
          },
        },
        { status: 409 },
      );
    }

    if (updates.title !== undefined) event.title = updates.title;
    if (updates.description !== undefined)
      event.description = updates.description;
    if (updates.location !== undefined) event.location = updates.location;
    if (updates.eventType !== undefined) event.eventType = updates.eventType;
    if (updates.timezone !== undefined) event.timezone = updates.timezone;
    event.startTime = nextStart;
    event.endTime = nextEnd;

    await event.save();

    if (timeChanged && group.reminders && group.reminders.length > 0) {
      const newEventStart = new Date(event.startTime).getTime();

      group.reminders = group.reminders.map((reminder: any) => {
        if (reminder.linkedEventId === eventId) {
          reminder.dueDate = new Date(
            newEventStart - reminder.offsetMinutes * 60000,
          );
        }
        return reminder;
      });

      group.markModified("reminders");
      await group.save();
    }

    return NextResponse.json({ event }, { status: 200 });
  } catch (err: any) {
    console.error("PUT calendar event error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; eventId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, eventId } = await params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }

    await dbConnect();

    // 1. use the helper here too
    const perms = await getMemberPermissions(groupId, userId);
    if ("error" in perms && perms.error) {
      return NextResponse.json(
        { error: perms.error },
        { status: perms.status },
      );
    }

    const event: any = await CalendarEvent.findOne({ _id: eventId, groupId });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // 2. authorize: creator OR anyone with canEdit (Leader/Admin)
    const isAuthorized = String(event.createdBy) === userId || perms.canEdit;
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await CalendarEvent.deleteOne({ _id: eventId, groupId });

    const group = perms.group;
    if (group.reminders) {
      group.reminders = group.reminders.filter(
        (r: any) => r.linkedEventId !== eventId,
      );
      group.markModified("reminders");
      await group.save();
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE calendar event error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

/** Toggle `isLocked` for reorder / regeneration preservation (no JSON body). */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string; eventId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, eventId } = await params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json({ error: "Invalid eventId" }, { status: 400 });
    }

    await dbConnect();

    const permissionResult = await getMemberPermissions(groupId, userId);
    if ("error" in permissionResult && permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }
    if (!permissionResult.canEdit) {
      return NextResponse.json(
        { error: "Forbidden: viewers cannot lock or unlock activities" },
        { status: 403 },
      );
    }

    const event: any = await CalendarEvent.findOne({ _id: eventId, groupId });
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const nextLocked = !Boolean(event.isLocked);
    event.isLocked = nextLocked;
    await event.save();

    return NextResponse.json(
      {
        event: {
          _id: String(event._id),
          isLocked: nextLocked,
        },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("PATCH calendar event (lock) error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

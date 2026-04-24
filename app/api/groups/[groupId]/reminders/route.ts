/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import CalendarEvent from "@/models/CalendarEvent";
import { scheduleReminder } from "@/lib/notifications";
import { randomUUID } from "crypto";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();
    const { groupId } = await context.params;

    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // returning the reminders array (the checklist)
    return NextResponse.json(group.reminders || []);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();
    const { groupId } = await context.params;
    const body = await req.json();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    let calculatedDueDate = body.dueDate ? new Date(body.dueDate) : null;

    // logic for linking to a calendar event (e.g., flight)
    if (body.linkedEventId && body.offsetMinutes !== undefined) {
      const event = await CalendarEvent.findById(body.linkedEventId);
      if (event) {
        // shift the time back by the offset (e.g. 180 mins for 3 hours before)
        calculatedDueDate = new Date(
          new Date(event.startTime).getTime() - body.offsetMinutes * 60000,
        );
      }
    }

    const newReminder = {
      id: randomUUID(),
      task: body.task,
      isCompleted: false,
      dueDate: calculatedDueDate,
      linkedEventId: body.linkedEventId || null,
      offsetMinutes: body.offsetMinutes || 0,
      createdBy: body.userId, // for the personal checklist filter
    };

    if (!group.reminders) {
      group.reminders = [];
    }

    group.reminders.push(newReminder);
    await group.save();

    // integration: schedule the notification in the standalone engine
    if (calculatedDueDate && body.userId) {
      await scheduleReminder(
        body.userId,
        body.task,
        calculatedDueDate,
        groupId,
      );
    }

    return NextResponse.json(newReminder, { status: 201 });
  } catch (error) {
    console.error("Reminder POST Error:", error);
    return NextResponse.json(
      { error: "Failed to create reminder" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();
    const { groupId } = await context.params;
    const { id, isCompleted, task } = await req.json();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const reminderIndex = group.reminders.findIndex((r: any) => r.id === id);
    if (reminderIndex === -1) {
      return NextResponse.json(
        { error: "Reminder not found" },
        { status: 404 },
      );
    }

    // update completion or task text
    if (isCompleted !== undefined)
      group.reminders[reminderIndex].isCompleted = isCompleted;
    if (task !== undefined) group.reminders[reminderIndex].task = task;

    await group.save();

    // integration: if completed, mark the notification engine version as done too
    if (isCompleted === true) {
      const { default: ReminderModel } = await import("@/models/Reminder");
      await ReminderModel.findOneAndUpdate(
        {
          groupID: groupId,
          text: group.reminders[reminderIndex].task,
          completed: false,
        },
        { completed: true },
      );
    }

    return NextResponse.json({
      success: true,
      reminder: group.reminders[reminderIndex],
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update reminder" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    await dbConnect();
    const { groupId } = await context.params;
    const { id } = await req.json();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group)
      return NextResponse.json({ error: "Group not found" }, { status: 404 });

    // integration: remove from notification engine if it exists
    const reminderToDelete = group.reminders.find((r: any) => r.id === id);
    if (reminderToDelete) {
      const { default: ReminderModel } = await import("@/models/Reminder");
      await ReminderModel.deleteOne({
        groupID: groupId,
        text: reminderToDelete.task,
        completed: false,
      });
    }

    group.reminders = group.reminders.filter((r: any) => r.id !== id);
    await group.save();

    return NextResponse.json({ message: "Reminder removed" }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
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

    // returning the checklist array
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

    // if a calendar event is linked we would calculate the due date here
    // this handles the auto shift logic for push notifications
    const autoDueDate = body.linkedEventId ? new Date() : null;

    const newReminder = {
      id: randomUUID(),
      task: body.task,
      isCompleted: false,
      dueDate: autoDueDate,
    };

    if (!group.reminders) {
      group.reminders = [];
    }

    group.reminders.push(newReminder);
    await group.save();

    // here is where you would trigger the push notification service
    // to alert the group about the new task or calendar sync

    return NextResponse.json(newReminder, { status: 201 });
  } catch (error) {
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
    const { id, isCompleted } = await req.json();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // find the specific reminder and flip the status
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const reminderIndex = group.reminders.findIndex((r: any) => r.id === id);
    if (reminderIndex === -1) {
      return NextResponse.json(
        { error: "Reminder not found" },
        { status: 404 },
      );
    }

    group.reminders[reminderIndex].isCompleted = isCompleted;
    await group.save();

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

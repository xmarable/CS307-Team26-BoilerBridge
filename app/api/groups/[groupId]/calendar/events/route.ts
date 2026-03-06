import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

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

const CreateEventSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  location: z.string().optional(),
  eventType: z.string().optional(),
  source: z.enum(["manual", "itinerary"]).optional(),
  externalId: z.string().optional(),
  timezone: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userMongoId = (session?.user as any)?.id as string | undefined;
    if (!userMongoId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;

    await dbConnect();

    // In this repo, [groupId] should be TravelGroup Mongo _id
    const group: any = await TravelGroup.findById(groupId).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isMemberOrLeader(group, userMongoId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = CreateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (data.endTime <= data.startTime) {
      return NextResponse.json(
        { error: "Invalid time range: endTime must be after startTime" },
        { status: 400 },
      );
    }

    const created = await CalendarEvent.create({
      title: data.title,
      description: data.description,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location,
      eventType: data.eventType ?? "general",
      createdBy: userMongoId, // store as string mongo id
      groupId: groupId, // store TravelGroup _id string for consistent queries
      source: data.source ?? "manual",
      externalId: data.externalId,
      timezone: data.timezone ?? "UTC",
    });

    return NextResponse.json({ event: created }, { status: 201 });
  } catch (err: any) {
    console.error("POST calendar event error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userMongoId = (session?.user as any)?.id as string | undefined;
    if (!userMongoId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;

    await dbConnect();

    const group: any = await TravelGroup.findById(groupId).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!isMemberOrLeader(group, userMongoId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    const now = new Date();
    const from = fromStr ? new Date(fromStr) : now;
    const to = toStr
      ? new Date(toStr)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid date params. Use ISO strings for from/to." },
        { status: 400 },
      );
    }
    if (to <= from) {
      return NextResponse.json(
        { error: "Invalid date range: to must be after from" },
        { status: 400 },
      );
    }

    // Overlap query: events that intersect [from, to)
    const events = await CalendarEvent.find({
      groupId,
      startTime: { $lt: to },
      endTime: { $gt: from },
    }).sort({ startTime: 1 });

    return NextResponse.json({ events }, { status: 200 });
  } catch (err: any) {
    console.error("GET calendar events error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

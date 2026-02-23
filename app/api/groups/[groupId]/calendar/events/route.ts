import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

import User from "@/models/User";
import TravelGroup from "@/models/TravelGroup";
import CalendarEvent from "@/models/CalendarEvent";

/**
 * Returns identifiers to use for membership comparisons.
 * - mongoId: session.user.id (Mongo _id string)
 * - uuid: user.userId
 */
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
    { params }: { params: { groupId: string } }
  ) {
    try {
      const ids = await getUserIdentifiers();
      if (!ids) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
  
      const { groupId } = params;
  
      await dbConnect();
  
      const group: any = await TravelGroup.findOne({ groupId }).lean();
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
  
      if (!isMember(group, ids)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
  
      const body = await req.json();
      const parsed = CreateEventSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid payload", details: parsed.error.flatten() },
          { status: 400 }
        );
      }
  
      const data = parsed.data;
      if (data.endTime <= data.startTime) {
        return NextResponse.json(
          { error: "Invalid time range: endTime must be after startTime" },
          { status: 400 }
        );
      }
  
      // Choose what to store in createdBy:
      // Prefer UUID if your User has one, otherwise use mongoId.
      const createdBy = ids.uuid ?? ids.mongoId;
  
      const created = await CalendarEvent.create({
        title: data.title,
        description: data.description,
        startTime: data.startTime,
        endTime: data.endTime,
        location: data.location,
        eventType: data.eventType ?? "general",
        createdBy,
        groupId,
        source: data.source ?? "manual",
        externalId: data.externalId,
        timezone: data.timezone ?? "UTC",
      });
  
      return NextResponse.json({ event: created }, { status: 201 });
    } catch (err: any) {
      console.error("POST /api/groups/:groupId/calendar/events error:", err);
      return NextResponse.json(
        { error: "Server error", details: err?.message ?? String(err) },
        { status: 500 }
      );
    }
  }

export async function GET(
    req: NextRequest,
    { params }: { params: { groupId: string } }
  ) {
    try {
      const ids = await getUserIdentifiers();
      if (!ids) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
  
      const { groupId } = params;
  
      await dbConnect();
  
      const group: any = await TravelGroup.findOne({ groupId }).lean();
      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
  
      if (!isMember(group, ids)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
  
      const { searchParams } = new URL(req.url);
      const fromStr = searchParams.get("from");
      const toStr = searchParams.get("to");
  
      const now = new Date();
      const from = fromStr ? new Date(fromStr) : now;
      const to = toStr ? new Date(toStr) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return NextResponse.json(
          { error: "Invalid date params. Use ISO strings for from/to." },
          { status: 400 }
        );
      }
      if (to <= from) {
        return NextResponse.json(
          { error: "Invalid date range: to must be after from" },
          { status: 400 }
        );
      }
  
      // Overlap query: start < to AND end > from
      const events = await CalendarEvent.find({
        groupId,
        startTime: { $lt: to },
        endTime: { $gt: from },
      }).sort({ startTime: 1 });
  
      return NextResponse.json({ events }, { status: 200 });
    } catch (err: any) {
      console.error("GET /api/groups/:groupId/calendar/events error:", err);
      return NextResponse.json(
        { error: "Server error", details: err?.message ?? String(err) },
        { status: 500 }
      );
    }
  }
  
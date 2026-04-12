import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import CalendarEvent from "@/models/CalendarEvent";
import { ProposedEventSchema } from "@/lib/itinerary/schemas";

const ApplyBodySchema = z.object({
  replaceEventIds: z.array(z.string().min(1)).min(1),
  proposedEvents: z.array(ProposedEventSchema).min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    const body = await req.json();
    const parsed = ApplyBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { replaceEventIds, proposedEvents } = parsed.data;

    const invalidIds = replaceEventIds.filter((id) => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Invalid event id(s)", invalidIds },
        { status: 400 },
      );
    }

    for (const ev of proposedEvents) {
      if (ev.endTime <= ev.startTime) {
        return NextResponse.json(
          { error: "Each proposed event must have endTime after startTime" },
          { status: 400 },
        );
      }
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
        { error: "Forbidden: insufficient permissions to apply itinerary changes" },
        { status: 403 },
      );
    }

    const existing = await CalendarEvent.find({
      _id: { $in: replaceEventIds },
      groupId,
    }).lean();

    if (existing.length !== replaceEventIds.length) {
      return NextResponse.json(
        { error: "One or more events to replace were not found in this group" },
        { status: 400 },
      );
    }

    const del = await CalendarEvent.deleteMany({
      _id: { $in: replaceEventIds },
      groupId,
    });
    if (del.deletedCount !== replaceEventIds.length) {
      return NextResponse.json(
        { error: "Could not remove all events to replace; none were modified." },
        { status: 409 },
      );
    }

    const docs = proposedEvents.map((ev) => ({
      title: ev.title,
      description: ev.description,
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: ev.location,
      eventType: ev.eventType ?? "general",
      createdBy: userId,
      groupId,
      source: "itinerary" as const,
      timezone: ev.timezone ?? "UTC",
    }));

    const inserted = await CalendarEvent.insertMany(docs);

    return NextResponse.json({ events: inserted }, { status: 200 });
  } catch (err: unknown) {
    console.error("POST itinerary/regenerate/apply error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 },
    );
  }
}

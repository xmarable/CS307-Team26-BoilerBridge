import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import CalendarEvent from "@/models/CalendarEvent";
import ItineraryOptionVote from "@/models/ItineraryOptionVote";
import Trip from "@/models/Trip";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ groupId: string; optionGroupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, optionGroupId } = await params;
    const uuid = z.string().uuid().safeParse(optionGroupId);
    if (!uuid.success) {
      return NextResponse.json({ error: "Invalid option group id" }, { status: 400 });
    }

    await dbConnect();

    const permissionResult = await getMemberPermissions(groupId, userId);
    if ("error" in permissionResult && permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }
    if (!permissionResult.isLeader) {
      return NextResponse.json(
        { error: "Forbidden: only the group leader can finalize a poll" },
        { status: 403 },
      );
    }

    const candidates = await CalendarEvent.find({
      groupId,
      optionGroupId,
      itineraryOptionStatus: "candidate",
    })
      .sort({ startTime: 1 })
      .lean();

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "No candidate options found for this poll" },
        { status: 404 },
      );
    }

    const votes = await ItineraryOptionVote.find({ groupId, optionGroupId }).lean();

    const tally: Record<string, number> = {};
    for (const c of candidates) {
      tally[String((c as { _id: unknown })._id)] = 0;
    }
    for (const v of votes) {
      const oid = String((v as { optionId: string }).optionId);
      if (Object.prototype.hasOwnProperty.call(tally, oid)) tally[oid] += 1;
    }

    const sorted = [...candidates].sort(
      (a, b) =>
        new Date((a as { startTime: Date }).startTime).getTime() -
        new Date((b as { startTime: Date }).startTime).getTime(),
    );

    let winnerId = String((sorted[0] as { _id: unknown })._id);
    let best = -1;
    for (const c of sorted) {
      const id = String((c as { _id: unknown })._id);
      const n = tally[id] ?? 0;
      if (n > best) {
        best = n;
        winnerId = id;
      }
    }

    const loserIds = candidates
      .map((c) => String((c as { _id: unknown })._id))
      .filter((id) => id !== winnerId);

    await CalendarEvent.updateOne(
      { _id: winnerId, groupId },
      { $set: { itineraryOptionStatus: "final" } },
    );

    const exclusions: string[] = [];
    for (const id of loserIds) {
      const doc = candidates.find((c) => String((c as { _id: unknown })._id) === id) as
        | { title?: string; linkedPlaceId?: string }
        | undefined;
      if (doc?.title?.trim()) exclusions.push(doc.title.trim());
      if (doc?.linkedPlaceId?.trim()) exclusions.push(doc.linkedPlaceId.trim());
      await CalendarEvent.updateOne(
        { _id: id, groupId },
        { $set: { itineraryOptionStatus: "removed" } },
      );
    }

    if (exclusions.length > 0) {
      const latestTrip = await Trip.findOne({ groupID: groupId as never })
        .sort({ createdAt: -1 })
        .select("_id");
      if (latestTrip) {
        await Trip.updateOne(
          { _id: latestTrip._id },
          { $addToSet: { avoidActivities: { $each: exclusions } } },
        );
      }
    }

    await ItineraryOptionVote.deleteMany({ groupId, optionGroupId } as never);

    return NextResponse.json({
      ok: true,
      winnerId,
      removedIds: loserIds,
    });
  } catch (err: unknown) {
    console.error("POST finalize poll:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

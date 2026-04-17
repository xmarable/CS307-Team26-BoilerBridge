import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";
import CalendarEvent from "@/models/CalendarEvent";
import ItineraryOptionVote from "@/models/ItineraryOptionVote";

const PostBodySchema = z.object({
  optionGroupId: z.string().uuid(),
  optionId: z.string().min(1),
});

export type PollPayload = {
  optionGroupId: string;
  tallies: Record<string, number>;
  myVote: string | null;
  candidates: Array<{ optionId: string; title: string; startTime: string }>;
};

async function buildPollsForGroup(
  groupId: string,
  userId: string,
  filterGroupIds?: string[],
): Promise<Record<string, PollPayload>> {
  const match: Record<string, unknown> = {
    groupId,
    itineraryOptionStatus: "candidate",
    optionGroupId:
      filterGroupIds && filterGroupIds.length > 0
        ? { $in: filterGroupIds }
        : { $exists: true, $nin: [null, ""] },
  };

  const events = await CalendarEvent.find(match).sort({ startTime: 1 }).lean();

  const byGroup = new Map<string, typeof events>();
  for (const ev of events) {
    const gid = String((ev as { optionGroupId?: string }).optionGroupId ?? "");
    if (!gid) continue;
    const arr = byGroup.get(gid) ?? [];
    arr.push(ev);
    byGroup.set(gid, arr);
  }

  const groupIds = [...byGroup.keys()];
  const votes = await ItineraryOptionVote.find({
    groupId,
    optionGroupId: { $in: groupIds },
  }).lean();

  const out: Record<string, PollPayload> = {};

  for (const gid of groupIds) {
    const evs = byGroup.get(gid)!;
    const tallies: Record<string, number> = {};
    for (const ev of evs) {
      tallies[String((ev as { _id: unknown })._id)] = 0;
    }
    let myVote: string | null = null;
    for (const v of votes) {
      const og = String((v as { optionGroupId: string }).optionGroupId);
      if (og !== gid) continue;
      const oid = String((v as { optionId: string }).optionId);
      const uid = String((v as { userId: string }).userId);
      if (uid === userId) myVote = oid;
      if (Object.prototype.hasOwnProperty.call(tallies, oid)) {
        tallies[oid] = (tallies[oid] ?? 0) + 1;
      }
    }

    const candidates = evs.map((ev) => ({
      optionId: String((ev as { _id: unknown })._id),
      title: String((ev as { title: string }).title),
      startTime: new Date((ev as { startTime: Date }).startTime).toISOString(),
    }));

    out[gid] = {
      optionGroupId: gid,
      tallies,
      myVote,
      candidates,
    };
  }

  return out;
}

export async function GET(
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
    await dbConnect();

    const permissionResult = await getMemberPermissions(groupId, userId);
    if ("error" in permissionResult && permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }

    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("optionGroupIds");
    const filterGroupIds = raw
      ? raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    const polls = await buildPollsForGroup(groupId, userId, filterGroupIds);
    return NextResponse.json({ polls });
  } catch (err: unknown) {
    console.error("GET itinerary votes:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

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
    const parsed = PostBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { optionGroupId, optionId } = parsed.data;

    if (!mongoose.Types.ObjectId.isValid(optionId)) {
      return NextResponse.json({ error: "Invalid option id" }, { status: 400 });
    }

    await dbConnect();

    const permissionResult = await getMemberPermissions(groupId, userId);
    if ("error" in permissionResult && permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error },
        { status: permissionResult.status },
      );
    }

    const ev = await CalendarEvent.findOne({
      _id: optionId,
      groupId,
      optionGroupId,
      itineraryOptionStatus: "candidate",
    });

    if (!ev) {
      return NextResponse.json(
        { error: "Option not found or not in this poll" },
        { status: 404 },
      );
    }

    await ItineraryOptionVote.findOneAndUpdate(
      { groupId, optionGroupId, userId },
      { groupId, optionGroupId, userId, optionId },
      { upsert: true, new: true },
    );

    const polls = await buildPollsForGroup(groupId, userId, [optionGroupId]);
    const poll = polls[optionGroupId];
    return NextResponse.json({ ok: true, poll });
  } catch (err: unknown) {
    console.error("POST itinerary votes:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

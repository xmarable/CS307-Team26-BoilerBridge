/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";

import TravelGroup from "@/models/TravelGroup";
import MustHave from "@/models/MustHave";

function isMemberOrLeader(group: any, userId: string) {
  const leader = group?.leaderID?.toString() === userId;
  const member =
    Array.isArray(group?.membersList) &&
    group.membersList.some((m: any) => m.userId?.toString() === userId);
  return leader || member;
}

function isLeader(group: any, userId: string) {
  return group?.leaderID?.toString() === userId;
}

const UpdateMustHaveSchema = z.object({
  notes: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional(),
  status: z.enum(["proposed", "approved", "rejected"]).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ groupId: string; id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, id } = await params;

    // We no longer use mongoose.Types.ObjectId.isValid because IDs are UUID strings
    if (!groupId || !id) {
      return NextResponse.json(
        { error: "Invalid ID parameters" },
        { status: 400 },
      );
    }

    await dbConnect();

    const group: any = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group)
      return NextResponse.json({ error: "Group not found" }, { status: 404 });

    if (!isMemberOrLeader(group, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const item: any = await MustHave.findOne({ id: id, groupID: groupId });
    if (!item)
      return NextResponse.json(
        { error: "Must-have not found" },
        { status: 404 },
      );

    const canEdit =
      item.addedBy?.toString() === userId || isLeader(group, userId);
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = UpdateMustHaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updates = parsed.data;

    if (updates.notes !== undefined) item.notes = updates.notes;
    if (updates.priority !== undefined) item.priority = updates.priority;
    if (updates.status !== undefined) item.status = updates.status;

    await item.save();

    return NextResponse.json({ mustHave: item }, { status: 200 });
  } catch (err: any) {
    console.error("PUT must-have error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ groupId: string; id: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId, id } = await params;

    if (!groupId || !id) {
      return NextResponse.json(
        { error: "Invalid ID parameters" },
        { status: 400 },
      );
    }

    await dbConnect();

    const group: any = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group)
      return NextResponse.json({ error: "Group not found" }, { status: 404 });

    if (!isMemberOrLeader(group, userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const item: any = await MustHave.findOne({
      id: id,
      groupID: groupId,
    }).lean();
    if (!item)
      return NextResponse.json(
        { error: "Must-have not found" },
        { status: 404 },
      );

    const canDelete =
      item.addedBy?.toString() === userId || isLeader(group, userId);
    if (!canDelete) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await MustHave.deleteOne({ id: id, groupID: groupId });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("DELETE must-have error:", err);
    return NextResponse.json(
      { error: "Server error", details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

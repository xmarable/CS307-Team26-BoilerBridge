import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";

const patchGroupSchema = z
  .object({
    groupName: z.string().min(1, "Group name is required").trim().optional(),
    description: z.string().trim().optional(),
  })
  .refine((data) => data.groupName !== undefined || data.description !== undefined, {
    message: "At least one of groupName or description is required",
  });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? session.user.id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to view this group" },
        { status: 401 }
      );
    }

    const { groupId } = await params;
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    await dbConnect();

    const group = await TravelGroup.findById(groupId).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const memberIds = (group.membersList as mongoose.Types.ObjectId[]).map(
      (m) => m.toString()
    );
    if (!memberIds.includes(userId)) {
      return NextResponse.json(
        { error: "You do not have access to this group" },
        { status: 403 }
      );
    }

    const leaderIDStr = (group.leaderID as mongoose.Types.ObjectId).toString();
    const isLeader = leaderIDStr === userId;

    const memberDocs = await User.find({
      _id: { $in: group.membersList as mongoose.Types.ObjectId[] },
    })
      .select("_id username email")
      .lean();

    const members = memberDocs.map((u: { _id: mongoose.Types.ObjectId; username: string; email: string }) => ({
      id: u._id.toString(),
      username: u.username,
      email: u.email,
    }));

    return NextResponse.json({
      group: {
        _id: group._id.toString(),
        groupID: group.groupID,
        groupName: group.groupName,
        description: group.description,
        leaderID: leaderIDStr,
        membersList: memberIds,
        isLeader,
        members,
      },
    });
  } catch (error) {
    console.error("GET /api/groups/[groupId] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? session.user.id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to update this group" },
        { status: 401 }
      );
    }

    const { groupId } = await params;
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    await dbConnect();

    const group = await TravelGroup.findById(groupId).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const memberIds = (group.membersList as mongoose.Types.ObjectId[]).map(
      (m) => m.toString()
    );
    if (!memberIds.includes(userId)) {
      return NextResponse.json(
        { error: "You do not have access to this group" },
        { status: 403 }
      );
    }

    const leaderIDStr = (group.leaderID as mongoose.Types.ObjectId).toString();
    if (leaderIDStr !== userId) {
      return NextResponse.json(
        { error: "Only the group leader can update the group" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = patchGroupSchema.safeParse(body);
    if (!validation.success) {
      const message =
        validation.error.issues[0]?.message ?? "Invalid input data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const update: { groupName?: string; description?: string } = {};
    if (validation.data.groupName !== undefined) update.groupName = validation.data.groupName;
    if (validation.data.description !== undefined) update.description = validation.data.description;

    const updated = await TravelGroup.findByIdAndUpdate(
      groupId,
      { $set: update },
      { new: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const updatedMemberIds = (updated.membersList as mongoose.Types.ObjectId[]).map(
      (m) => m.toString()
    );

    return NextResponse.json({
      group: {
        _id: updated._id.toString(),
        groupID: updated.groupID,
        groupName: updated.groupName,
        description: updated.description,
        leaderID: (updated.leaderID as mongoose.Types.ObjectId).toString(),
        membersList: updatedMemberIds,
      },
    });
  } catch (error) {
    console.error("PATCH /api/groups/[groupId] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

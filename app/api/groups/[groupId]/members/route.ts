import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";

const addMemberSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().optional(),
  })
  .refine((data) => data.email !== undefined || data.userId !== undefined, {
    message: "Either email or userId is required",
  });

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? session.user.id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to add members" },
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
        { error: "Only the group leader can add members" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = addMemberSchema.safeParse(body);
    if (!validation.success) {
      const message =
        validation.error.issues[0]?.message ?? "Invalid input data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    let userToAdd:
      | { _id: mongoose.Types.ObjectId; username?: string; email?: string }
      | null = null;

    if (validation.data.email !== undefined) {
      userToAdd = await User.findOne({
        email: validation.data.email.trim().toLowerCase(),
      }).lean();
    } else if (validation.data.userId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(validation.data.userId)) {
        return NextResponse.json(
          { error: "Invalid userId" },
          { status: 400 }
        );
      }
      userToAdd = await User.findById(validation.data.userId).lean();
    }

    if (!userToAdd) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const newMemberId = (userToAdd._id as mongoose.Types.ObjectId).toString();
    if (memberIds.includes(newMemberId)) {
      return NextResponse.json(
        { error: "User is already in the group" },
        { status: 400 }
      );
    }

    await TravelGroup.findByIdAndUpdate(groupId, {
      $addToSet: { membersList: userToAdd._id },
    });

    const updated = await TravelGroup.findById(groupId).lean();
    const updatedMemberIds = (updated!.membersList as mongoose.Types.ObjectId[]).map(
      (m) => m.toString()
    );

    return NextResponse.json(
      {
        message: "Member added",
        group: {
          _id: updated!._id.toString(),
          groupID: updated!.groupID,
          groupName: updated!.groupName,
          description: updated!.description,
          leaderID: (updated!.leaderID as mongoose.Types.ObjectId).toString(),
          membersList: updatedMemberIds,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/groups/[groupId]/members error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

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
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to add members" },
        { status: 401 },
      );
    }

    const { groupId } = await params;

    await dbConnect();

    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const memberIds = group.membersList.map((m: any) => m.userId.toString());

    if (!memberIds.includes(userId)) {
      return NextResponse.json(
        { error: "You do not have access to this group" },
        { status: 403 },
      );
    }

    if (group.leaderID.toString() !== userId) {
      return NextResponse.json(
        { error: "Only the group leader can add members" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validation = addMemberSchema.safeParse(body);
    if (!validation.success) {
      const message =
        validation.error.issues[0]?.message ?? "Invalid input data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    let userToAdd: any = null;
    if (validation.data.email) {
      userToAdd = await User.findOne({
        email: validation.data.email.trim().toLowerCase(),
      }).lean();
    } else if (validation.data.userId) {
      userToAdd = await User.findOne({ userId: validation.data.userId }).lean();
    }

    if (!userToAdd) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newMemberId = userToAdd.userId.toString();
    if (memberIds.includes(newMemberId)) {
      return NextResponse.json(
        { error: "User is already in the group" },
        { status: 400 },
      );
    }

    const updated = await TravelGroup.findOneAndUpdate(
      { groupID: groupId },
      {
        $addToSet: {
          membersList: {
            userId: userToAdd.userId,
            role: "Viewer", // Default role from your schema
          },
        },
      },
      { returnDocument: "after" },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        message: "Member added",
        group: {
          groupID: updated.groupID.toString(),
          groupName: updated.groupName,
          description: updated.description,
          leaderID: updated.leaderID.toString(),
          membersList: updated.membersList.map((m: any) => ({
            userId: m.userId.toString(),
            role: m.role,
          })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/groups/[groupId]/members error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

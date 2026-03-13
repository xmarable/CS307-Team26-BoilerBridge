import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to leave a group" },
        { status: 401 },
      );
    }

    const { groupId } = await params;
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    await dbConnect();

    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const memberIds = (group.membersList as any[]).map((m) => m.userId);
    if (!memberIds.includes(userId)) {
      return NextResponse.json(
        { error: "You do not have access to this group" },
        { status: 403 },
      );
    }

    const isLeader = group.leaderID === userId;
    const memberCount = memberIds.length;

    if (isLeader) {
      // Sole member: delete the group entirely
      if (memberCount === 1) {
        await TravelGroup.findByIdAndDelete(groupId);
        return NextResponse.json({ message: "Group deleted" }, { status: 200 });
      }

      // Leader with other members: auto-transfer leadership to the first other member
      const newLeaderId = memberIds.find((id) => id !== userId);
      if (!newLeaderId) {
        return NextResponse.json(
          { error: "No eligible member to transfer leadership" },
          { status: 400 },
        );
      }

      const updated = await TravelGroup.findOneAndUpdate(
        { groupID: groupId },
        {
          $set: { leaderID: newLeaderId },
          $pull: { membersList: { userId: userId } },
        },
        { new: true },
      ).lean();

      if (!updated) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      return NextResponse.json({
        group: {
          groupID: updated.groupID,
          groupName: updated.groupName,
          description: updated.description,
          leaderID: updated.leaderID,
          membersList: updated.membersList,
        },
      });
    }

    // Non-leader: simply remove from membersList
    const updated = await TravelGroup.findOneAndUpdate(
      { groupID: groupId },
      { $pull: { membersList: { userId: userId } } },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({
      group: {
        groupID: updated.groupID,
        groupName: updated.groupName,
        description: updated.description,
        leaderID: updated.leaderID,
        membersList: updated.membersList,
      },
    });
  } catch (error) {
    console.error("POST /api/groups/[groupId]/leave error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

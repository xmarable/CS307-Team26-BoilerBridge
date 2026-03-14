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

    const isLeader = group.leaderID.toString() === userId;
    const memberCount = memberIds.length;

    if (isLeader) {
      // Sole member: delete the group entirely
      if (memberCount === 1) {
        await TravelGroup.deleteOne({ groupID: groupId });
        return NextResponse.json({ message: "Group deleted" }, { status: 200 });
      }

      // Leader with other members: auto-transfer leadership to the first other member
      const newLeaderId = memberIds.find((id: string) => id !== userId);
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
        { returnDocument: "after" },
      ).lean();

      // Update the new leader's role to "Leader" in the membersList
      if (updated) {
        await TravelGroup.updateOne(
          { groupID: groupId, "membersList.userId": newLeaderId },
          { $set: { "membersList.$.role": "Leader" } },
        );
      }

      // Re-fetch to get final state with updated roles
      const finalGroup = await TravelGroup.findOne({ groupID: groupId }).lean();

      return NextResponse.json({
        group: {
          groupID: finalGroup!.groupID.toString(),
          groupName: finalGroup!.groupName,
          description: finalGroup!.description,
          leaderID: finalGroup!.leaderID.toString(),
          membersList: finalGroup!.membersList.map((m: any) => ({
            userId: m.userId.toString(),
            role: m.role,
          })),
        },
      });
    }

    // Non-leader: simply remove from membersList
    const updated = await TravelGroup.findOneAndUpdate(
      { groupID: groupId },
      { $pull: { membersList: { userId: userId } } },
      { returnDocument: "after" },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    console.error("POST /api/groups/[groupId]/leave error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

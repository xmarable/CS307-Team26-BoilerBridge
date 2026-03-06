import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? session.user.id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to leave a group" },
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
    const memberCount = memberIds.length;

    if (isLeader) {
      // Sole member: delete the group entirely
      if (memberCount === 1) {
        await TravelGroup.findByIdAndDelete(groupId);
        return NextResponse.json(
          { message: "Group deleted" },
          { status: 200 }
        );
      }

      // Leader with other members: auto-transfer leadership to the first other member
      const newLeaderId = memberIds.find((id) => id !== userId);
      if (!newLeaderId) {
        return NextResponse.json(
          { error: "No eligible member to transfer leadership" },
          { status: 400 }
        );
      }

      const updated = await TravelGroup.findByIdAndUpdate(
        groupId,
        {
          $set: { leaderID: new mongoose.Types.ObjectId(newLeaderId) },
          $pull: { membersList: new mongoose.Types.ObjectId(userId) },
        },
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
    }

    // Non-leader: simply remove from membersList
    const updated = await TravelGroup.findByIdAndUpdate(
      groupId,
      { $pull: { membersList: new mongoose.Types.ObjectId(userId) } },
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
    console.error("POST /api/groups/[groupId]/leave error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

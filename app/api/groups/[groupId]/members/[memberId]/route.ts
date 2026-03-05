import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? session.user.id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to remove members" },
        { status: 401 }
      );
    }

    const { groupId, memberId } = await params;
    if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }
    if (!memberId || !mongoose.Types.ObjectId.isValid(memberId)) {
      return NextResponse.json({ error: "Invalid member ID" }, { status: 400 });
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
        { error: "Only the group leader can remove members" },
        { status: 403 }
      );
    }

    if (leaderIDStr === memberId) {
      return NextResponse.json(
        { error: "Cannot remove the group leader" },
        { status: 400 }
      );
    }

    if (!memberIds.includes(memberId)) {
      return NextResponse.json(
        { error: "Member not found in group" },
        { status: 404 }
      );
    }

    await TravelGroup.findByIdAndUpdate(groupId, {
      $pull: { membersList: new mongoose.Types.ObjectId(memberId) },
    });

    const updated = await TravelGroup.findById(groupId).lean();
    const updatedMemberIds = (updated!.membersList as mongoose.Types.ObjectId[]).map(
      (m) => m.toString()
    );

    return NextResponse.json({
      message: "Member removed",
      group: {
        _id: updated!._id.toString(),
        groupID: updated!.groupID,
        groupName: updated!.groupName,
        description: updated!.description,
        leaderID: (updated!.leaderID as mongoose.Types.ObjectId).toString(),
        membersList: updatedMemberIds,
      },
    });
  } catch (error) {
    console.error(
      "DELETE /api/groups/[groupId]/members/[memberId] error:",
      error
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

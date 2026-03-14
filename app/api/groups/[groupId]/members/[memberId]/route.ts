import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to remove members" },
        { status: 401 },
      );
    }

    const { groupId, memberId } = await params;

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

    const leaderIDStr = group.leaderID.toString();
    if (leaderIDStr !== userId) {
      return NextResponse.json(
        { error: "Only the group leader can remove members" },
        { status: 403 },
      );
    }

    if (leaderIDStr === memberId) {
      return NextResponse.json(
        { error: "Cannot remove the group leader" },
        { status: 400 },
      );
    }

    if (!memberIds.includes(memberId)) {
      return NextResponse.json(
        { error: "Member not found in group" },
        { status: 404 },
      );
    }

    // Pull from membersList using the userId UUID
    const updated = await TravelGroup.findOneAndUpdate(
      { groupID: groupId },
      { $pull: { membersList: { userId: memberId } } },
      { returnDocument: "after" },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Member removed",
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
    console.error(
      "DELETE /api/groups/[groupId]/members/[memberId] error:",
      error,
    );
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

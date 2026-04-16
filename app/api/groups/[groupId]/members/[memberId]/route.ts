/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

/**
 * handles removing a member from a group.
 * restricted to the group leader only.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ groupId: string; memberId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    // verify authentication
    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId, memberId } = await params;

    await dbConnect();

    // fetch group and verify existence
    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    // gather member ids for validation
    const memberIds = group.membersList.map((m: any) => m.userId.toString());

    // verify requester is a member
    if (!memberIds.includes(userId.toString())) {
      return NextResponse.json(
        { error: "forbidden: access denied" },
        { status: 403 },
      );
    }

    // ac: verify current user is the group leader
    const leaderIDStr = group.leaderID.toString();
    if (leaderIDStr !== userId.toString()) {
      return NextResponse.json(
        { error: "forbidden: only the leader can remove members" },
        { status: 403 },
      );
    }

    // block attempt to remove self via this route
    if (leaderIDStr === memberId) {
      return NextResponse.json(
        { error: "cannot remove the group leader" },
        { status: 400 },
      );
    }

    // verify target exists in group
    if (!memberIds.includes(memberId)) {
      return NextResponse.json(
        { error: "member not found in group" },
        { status: 404 },
      );
    }

    // perform atomic update to pull member from list
    const updated = await TravelGroup.findOneAndUpdate(
      { groupID: groupId },
      { $pull: { membersList: { userId: memberId } } },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "update failed" }, { status: 404 });
    }

    return NextResponse.json({
      message: "member removed",
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
  } catch (error: any) {
    console.error(
      "DELETE /api/groups/[groupId]/members/[memberId] error:",
      error,
    );
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

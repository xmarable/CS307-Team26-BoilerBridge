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

    const leaderIDStr = group.leaderID.toString();
    const requesterMember = group.membersList.find(
      (m: any) => m.userId.toString() === userId.toString(),
    );
    const requesterRole = requesterMember?.role;
    const isRequesterLeader = leaderIDStr === userId.toString();
    const isRequesterAdmin = requesterRole === "Admin";

    if (!isRequesterLeader && !isRequesterAdmin) {
      return NextResponse.json(
        { error: "forbidden: only leaders and admins can remove members" },
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

    // admins cannot remove other admins — only the leader can do that
    if (isRequesterAdmin && !isRequesterLeader) {
      const targetMember = group.membersList.find(
        (m: any) => m.userId.toString() === memberId,
      );
      if (targetMember?.role === "Admin") {
        return NextResponse.json(
          { error: "forbidden: admins cannot remove other admins" },
          { status: 403 },
        );
      }
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

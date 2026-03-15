import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

/**
 * handles a member voluntarily leaving a group.
 * includes logic for group deletion if last member leaves,
 * and auto-transfer of leadership if the leader leaves.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;

    await dbConnect();

    // fetch group to check current membership and leadership status
    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const memberIds = group.membersList.map((m: any) => m.userId.toString());
    const userIdStr = userId.toString();

    if (!memberIds.includes(userIdStr)) {
      return NextResponse.json(
        { error: "forbidden: not a member of this group" },
        { status: 403 },
      );
    }

    const isLeader = group.leaderID.toString() === userIdStr;
    const memberCount = memberIds.length;

    if (isLeader) {
      // case: sole member leaves - delete the group
      if (memberCount === 1) {
        await TravelGroup.deleteOne({ groupID: groupId });
        return NextResponse.json({ message: "group deleted" }, { status: 200 });
      }

      // case: leader leaves with others present - auto-transfer leadership
      const newLeaderIdStr = memberIds.find((id: string) => id !== userIdStr);
      if (!newLeaderIdStr) {
        return NextResponse.json(
          { error: "no eligible successor found" },
          { status: 400 },
        );
      }

      // step 1: update leaderid and promote successor
      // we must split this from the $pull operation below because mongodb
      // throws a conflict error if you set and pull from the same array simultaneously
      await TravelGroup.findOneAndUpdate(
        { groupID: groupId },
        {
          $set: {
            leaderID: newLeaderIdStr,
            "membersList.$[successor].role": "Leader",
          },
        },
        {
          arrayFilters: [{ "successor.userId": newLeaderIdStr }],
        },
      );

      // step 2: safely remove the old leader from the memberslist
      const updated = await TravelGroup.findOneAndUpdate(
        { groupID: groupId },
        { $pull: { membersList: { userId: userIdStr } } },
        { new: true },
      ).lean();

      if (!updated) {
        throw new Error("failed to retrieve group after leader transfer");
      }

      return NextResponse.json({
        message: "successfully left group and transferred leadership",
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
    }

    // case: non-leader leaves - simply remove from memberslist
    const updated = await TravelGroup.findOneAndUpdate(
      { groupID: groupId },
      { $pull: { membersList: { userId: userIdStr } } },
      { new: true },
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "successfully left group",
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
    console.error("POST /api/groups/[groupId]/leave error:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

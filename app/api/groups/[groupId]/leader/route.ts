import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

const patchLeaderSchema = z.object({
  newLeaderId: z.string().uuid("newLeaderId must be a valid UUID"),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to transfer leadership" },
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
    const currentLeaderID = group.leaderID.toString();

    if (!memberIds.includes(userId)) {
      return NextResponse.json(
        { error: "You do not have access to this group" },
        { status: 403 },
      );
    }

    if (currentLeaderID !== userId) {
      return NextResponse.json(
        { error: "Only the group leader can transfer leadership" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validation = patchLeaderSchema.safeParse(body);
    if (!validation.success) {
      const message =
        validation.error.issues[0]?.message ?? "Invalid input data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { newLeaderId } = validation.data;

    if (newLeaderId === userId) {
      return NextResponse.json(
        { error: "Cannot transfer leadership to yourself" },
        { status: 400 },
      );
    }

    if (!memberIds.includes(newLeaderId)) {
      return NextResponse.json(
        { error: "User is not a member of this group" },
        { status: 400 },
      );
    }

    const updated = await TravelGroup.findOneAndUpdate(
      { groupID: groupId },
      {
        $set: {
          leaderID: newLeaderId,
          "membersList.$[newLeader].role": "Leader",
          "membersList.$[oldLeader].role": "Admin",
        },
      },
      {
        arrayFilters: [
          { "newLeader.userId": newLeaderId },
          { "oldLeader.userId": userId },
        ],
        returnDocument: "after",
      },
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
    console.error("PATCH /api/groups/[groupId]/leader error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

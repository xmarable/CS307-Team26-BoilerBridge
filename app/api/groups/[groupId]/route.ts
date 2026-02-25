import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user && "id" in session.user ? session.user.id : undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to view this group" },
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

    return NextResponse.json({
      group: {
        _id: group._id.toString(),
        groupID: group.groupID,
        groupName: group.groupName,
        description: group.description,
        leaderID: (group.leaderID as mongoose.Types.ObjectId).toString(),
        membersList: memberIds,
      },
    });
  } catch (error) {
    console.error("GET /api/groups/[groupId] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

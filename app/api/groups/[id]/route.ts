import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be logged in to view this group" },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
    }

    await dbConnect();

    const group = await TravelGroup.findById(id).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const memberIds = (group.membersList as mongoose.Types.ObjectId[]).map(
      (m) => m.toString()
    );
    if (!memberIds.includes(session.user.id)) {
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
    console.error("GET /api/groups/[id] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

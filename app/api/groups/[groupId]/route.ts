import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";

export async function GET(
  req: Request,
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

    // use findone with groupid because your params are uuid strings
    const groupDoc = await TravelGroup.findOne({ groupID: groupId }).lean();

    if (!groupDoc) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    // verify membership so random users can't snoop
    const isMember = groupDoc.membersList.some(
      (m: any) => m.userId.toString() === userId.toString(),
    );

    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. You do not have access to this group." }, // matches /do not have access/i
        { status: 403 },
      );
    }

    // returning the full doc plus the specific keys your frontend needs
    return NextResponse.json({
      group: {
        ...groupDoc,
        currentUserId: userId, // fixes the 'viewer' badge bug
        isLeader: groupDoc.leaderID.toString() === userId.toString(),
        members: groupDoc.membersList,
      },
    });
  } catch (error: any) {
    console.error("GET group error:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    const { groupName } = await req.json();

    await dbConnect();

    // only allow the leader to change the name
    const updatedGroup = await TravelGroup.findOneAndUpdate(
      { groupID: groupId, leaderID: userId },
      { $set: { groupName } },
      { new: true },
    ).lean();

    if (!updatedGroup) {
      return NextResponse.json(
        { error: "failed to update: only the leader can do this" },
        { status: 403 },
      );
    }

    return NextResponse.json({ group: updatedGroup });
  } catch (error) {
    console.error("PATCH group error:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

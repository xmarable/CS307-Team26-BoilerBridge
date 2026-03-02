import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const rawId = session?.user && "id" in session.user ? session.user.id : undefined;
    const userId = typeof rawId === "string" ? rawId : undefined;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to view your groups" },
        { status: 401 }
      );
    }

    await dbConnect();

    const groups = await TravelGroup.find({
      membersList: new mongoose.Types.ObjectId(userId),
    })
      .lean();

    const payload = groups.map((g) => ({
      _id: (g._id as mongoose.Types.ObjectId).toString(),
      groupID: g.groupID,
      groupName: g.groupName,
      description: g.description,
      leaderID: (g.leaderID as mongoose.Types.ObjectId).toString(),
      membersList: (g.membersList as mongoose.Types.ObjectId[]).map((m) =>
        m.toString()
      ),
    }));

    return NextResponse.json({ groups: payload });
  } catch (error) {
    console.error("GET /api/groups error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

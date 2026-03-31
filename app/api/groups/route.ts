import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;
    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to view your groups" },
        { status: 401 },
      );
    }

    await dbConnect();

    const groups = await TravelGroup.find({
      "membersList.userId": userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    const payload = groups.map((g: any) => ({
      groupID: g.groupID,
      groupName: g.groupName,
      description: g.description,
      leaderID: g.leaderID,
      membersList: g.membersList,
      createdAt: g.createdAt,
    }));

    return NextResponse.json({ groups: payload });
  } catch (error) {
    console.error("GET /api/groups error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupName, description } = await req.json();
    if (!groupName) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 },
      );
    }

    await dbConnect();

    const newGroup = await TravelGroup.create({
      groupName,
      description: description || "",
      leaderID: userId,
      membersList: [
        {
          userId: userId,
          role: "Leader",
        },
      ],
    });

    return NextResponse.json(
      {
        group: {
          groupID: newGroup.groupID,
          groupName: newGroup.groupName,
          description: newGroup.description,
          leaderID: newGroup.leaderID,
          membersList: newGroup.membersList,
          createdAt: newGroup.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/groups error:", error);
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 },
    );
  }
}

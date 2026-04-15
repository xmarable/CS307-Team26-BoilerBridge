/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import Trip from "@/models/Trip";

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

    // 1. find all groups the user is in
    const groups = await TravelGroup.find({
      "membersList.userId": userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    // 2. get the group IDs
    const groupIds = groups.map((g) => g.groupID);

    // 3. find which of those groups actually have an existing trip
    const activeTrips = await Trip.find({
      groupID: { $in: groupIds },
    })
      .select("groupID")
      .lean();

    // using toString() to ensure UUID comparison works
    const activeGroupIds = new Set(
      activeTrips.map((t) => t.groupID.toString()),
    );

    // 4. filter the payload to only include groups that have a trip
    const payload = groups
      .filter((g: any) => activeGroupIds.has(g.groupID.toString()))
      .map((g: any) => ({
        groupID: g.groupID.toString(), // stringify for frontend
        groupName: g.groupName,
        description: g.description,
        leaderID: g.leaderID.toString(),
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

    // create the group
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

    // create the associated trip skeleton so the group actually shows up in the list
    await Trip.create({
      groupID: newGroup.groupID,
      tripName: `${groupName} Trip`,
      destination: "TBD",
      startDate: new Date(),
      endDate: new Date(),
    });

    return NextResponse.json(
      {
        group: {
          groupID: newGroup.groupID.toString(),
          groupName: newGroup.groupName,
          description: newGroup.description,
          leaderID: newGroup.leaderID.toString(),
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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";

const patchGroupSchema = z
  .object({
    groupName: z.string().min(1, "Group name is required").trim().optional(),
    description: z.string().trim().optional(),
  })
  .refine(
    (data) => data.groupName !== undefined || data.description !== undefined,
    {
      message: "At least one of groupName or description is required",
    },
  );

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to view this group" },
        { status: 401 },
      );
    }

    const { groupId } = await params;
    await dbConnect();

    // Query by our standardized UUID field, not _id
    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Check membership in the new object-based membersList
    const memberEntry = group.membersList.find((m: any) => m.userId === userId);
    if (!memberEntry) {
      return NextResponse.json(
        { error: "You do not have access to this group" },
        { status: 403 },
      );
    }

    // Fetch user details for the members list
    const memberIds = group.membersList.map((m: any) => m.userId);
    const memberDocs = await User.find({
      userId: { $in: memberIds },
    })
      .select("userId username email")
      .lean();

    const members = group.membersList.map((m: any) => {
      const details = memberDocs.find((u: any) => u.userId === m.userId);
      return {
        userId: m.userId,
        role: m.role,
        username: details?.username || "Unknown",
        email: details?.email || "",
      };
    });

    return NextResponse.json({
      group: {
        groupID: group.groupID,
        groupName: group.groupName,
        description: group.description,
        leaderID: group.leaderID,
        isLeader: group.leaderID === userId,
        userRole: memberEntry.role,
        members,
      },
    });
  } catch (error) {
    console.error("GET /api/groups/[groupId] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
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
      return NextResponse.json(
        { error: "You must be logged in to update this group" },
        { status: 401 },
      );
    }

    const { groupId } = await params;
    await dbConnect();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Only the leader can update group settings
    if (group.leaderID !== userId) {
      return NextResponse.json(
        { error: "Only the group leader can update the group" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validation = patchGroupSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message ?? "Invalid input data" },
        { status: 400 },
      );
    }

    if (validation.data.groupName) group.groupName = validation.data.groupName;
    if (validation.data.description !== undefined)
      group.description = validation.data.description;

    await group.save();

    return NextResponse.json({
      success: true,
      group: {
        groupID: group.groupID,
        groupName: group.groupName,
        description: group.description,
      },
    });
  } catch (error) {
    console.error("PATCH /api/groups/[groupId] error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import { z } from "zod";

const createGroupSchema = z.object({
  groupName: z.string().min(1, "Group name is required").trim(),
  description: z.string().trim().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "You must be logged in to create a group" },
        { status: 401 },
      );
    }

    await dbConnect();

    const body = await req.json();
    const validation = createGroupSchema.safeParse(body);

    if (!validation.success) {
      const message =
        validation.error.issues[0]?.message ?? "Invalid input data";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { groupName, description } = validation.data;

    // Create group with object-based membersList to match schema requirements
    const newGroup = new TravelGroup({
      groupName,
      description: description || "",
      leaderID: userId,
      membersList: [
        {
          userId: userId,
          role: "Leader",
        },
      ],
      ledger: [],
      chatLogs: [],
    });

    await newGroup.save();

    return NextResponse.json(
      {
        message: "Group created",
        group: {
          groupID: newGroup.groupID.toString(),
          groupName: newGroup.groupName,
          description: newGroup.description,
          leaderID: newGroup.leaderID.toString(),
          membersList: newGroup.membersList.map((m: any) => ({
            userId: m.userId.toString(),
            role: m.role,
          })),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/groups/create error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

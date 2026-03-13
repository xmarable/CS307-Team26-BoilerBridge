import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // 1. Find the current user to get their UUID and display name
    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // 2. Parse the announcement content from request body
    const { content } = await req.json();
    if (!content || content.trim() === "") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    // 3. Find the group and verify the user is a member
    // THIS IS WHERE YOU check if they are an 'Admin' or 'Leader' specifically
    const group = await TravelGroup.findOne({ groupID: groupId }).lean();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const isMember = group.membersList.includes(currentUser.userId);
    if (!isMember) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // 4. Create the new announcement object
    const newAnnouncement = {
      content: content.trim(),
      pinnedBy: currentUser.name || currentUser.username,
      pinnedByID: currentUser.userId,
      timestamp: new Date(),
    };

    // 5. Push to the array and save
    group.pinnedAnnouncements.push(newAnnouncement);
    await group.save();

    return NextResponse.json(newAnnouncement, { status: 201 });
  } catch (error) {
    console.error("Failed to post announcement:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { groupId: string } },
) {
  try {
    await dbConnect();
    const group = await TravelGroup.findOne({ groupID: params.groupId })
      .select("pinnedAnnouncements")
      .lean();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Sort by timestamp descending (newest first)
    const sortedAnnouncements = group.pinnedAnnouncements.sort(
      (a: any, b: any) => b.timestamp.getTime() - a.timestamp.getTime(),
    );

    return NextResponse.json(sortedAnnouncements);
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

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

    // Keep the User lookup for the display name and UUID
    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { content } = await req.json();
    if (!content || content.trim() === "") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 },
      );
    }

    // Keep the findOne lookup by groupID UUID
    const group = await TravelGroup.findOne({ groupID: groupId });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Corrected check: membersList is an array of objects { userId, role }
    const memberRecord = group.membersList.find(
      (m: any) => m.userId === currentUser.userId,
    );

    if (!memberRecord) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Keep the same announcement object structure
    const newAnnouncement = {
      content: content.trim(),
      pinnedBy: currentUser.name || currentUser.username,
      pinnedByID: currentUser.userId,
      timestamp: new Date(),
    };

    group.pinnedAnnouncements.push(newAnnouncement);
    await group.save();

    return NextResponse.json(newAnnouncement, { status: 201 });
  } catch (error) {
    console.error("Failed to post announcement:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    await dbConnect();

    const group = await TravelGroup.findOne({ groupID: groupId })
      .select("pinnedAnnouncements")
      .lean();

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const sortedAnnouncements = (group.pinnedAnnouncements || []).sort(
      (a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return NextResponse.json(sortedAnnouncements);
  } catch (error) {
    console.error("Failed to fetch announcements:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

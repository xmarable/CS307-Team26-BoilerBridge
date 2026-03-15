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

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const memberRecord = group.membersList.find(
      (m: any) => m.userId === currentUser.userId,
    );

    // AC: Create the logic for leaders to add messages
    if (!memberRecord || !["Leader", "Admin"].includes(memberRecord.role)) {
      return NextResponse.json(
        { error: "Only leaders can pin announcements" },
        { status: 403 },
      );
    }

    const newAnnouncement = {
      content: content.trim(),
      pinnedBy: currentUser.name || currentUser.username,
      pinnedByID: currentUser.userId,
      timestamp: new Date(),
    };

    // AC: Message appears at the top (unshift adds to the beginning of the array)
    group.pinnedAnnouncements.unshift(newAnnouncement);
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

    // AC: Ensure view is sorted by timestamp (newest first)
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

export async function DELETE(
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

    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { announcementID } = await req.json();
    if (!announcementID) {
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 },
      );
    }

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group)
      return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const memberRecord = group.membersList.find(
      (m: any) => m.userId === currentUser.userId,
    );

    // AC: Create the logic for leaders to remove messages
    if (!memberRecord || !["Leader", "Admin"].includes(memberRecord.role)) {
      return NextResponse.json(
        { error: "Only leaders can unpin announcements" },
        { status: 403 },
      );
    }

    // AC: Item is removed from the view for all members
    group.pinnedAnnouncements = group.pinnedAnnouncements.filter(
      (a: any) => a.announcementID !== announcementID,
    );

    await group.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

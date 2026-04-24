/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import mongoose from "mongoose";

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

    const currentUser = await User.findOne({
      email: session.user.email,
    }).lean();
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

    /**
     * UUID FIX: Querying with BSON UUID
     */
    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    /**
     * UUID FIX: Normalize to string for comparison
     */
    const currentUserIdStr = currentUser.userId.toString();
    const memberRecord = group.membersList.find(
      (m: any) => m.userId.toString() === currentUserIdStr,
    );

    // AC: Create the logic for leaders to add messages
    if (!memberRecord || !["Leader", "Admin"].includes(memberRecord.role)) {
      return NextResponse.json(
        { error: "Only leaders can pin announcements" },
        { status: 403 },
      );
    }

    const newAnnouncement = {
      announcementID: new (mongoose.Types as any).UUID(), // ensure ID is generated properly
      content: content.trim(),
      pinnedBy: currentUser.username || currentUser.name || "Leader",
      pinnedByID: currentUser.userId,
      timestamp: new Date(),
    };

    // AC: Message appears at the top
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

    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId })
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

    const currentUser = await User.findOne({
      email: session.user.email,
    }).lean();
    if (!currentUser)
      return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { announcementID } = await req.json();
    if (!announcementID) {
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 },
      );
    }

    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId });
    if (!group)
      return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const currentUserIdStr = currentUser.userId.toString();
    const memberRecord = group.membersList.find(
      (m: any) => m.userId.toString() === currentUserIdStr,
    );

    // AC: Create the logic for leaders to remove messages
    if (!memberRecord || !["Leader", "Admin"].includes(memberRecord.role)) {
      return NextResponse.json(
        { error: "Only leaders can unpin announcements" },
        { status: 403 },
      );
    }

    // AC: Item is removed from the view for all members
    // UUID comparison fix for deletion
    group.pinnedAnnouncements = group.pinnedAnnouncements.filter(
      (a: any) => a.announcementID.toString() !== announcementID.toString(),
    );

    await group.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import CalendarEvent from "@/models/CalendarEvent";
import Trip from "@/models/Trip";

export async function GET(
  req: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await context.params;
    await dbConnect();

    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const groupDoc = await TravelGroup.findOne({
      groupID: binaryGroupId,
    }).lean();

    if (!groupDoc) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const isMember = groupDoc.membersList.some(
      (m: any) => m.userId.toString() === userId.toString(),
    );

    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. You do not have access to this group." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      group: {
        ...groupDoc,
        groupID: groupDoc.groupID.toString(),
        leaderID: groupDoc.leaderID.toString(),
        currentUserId: userId,
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
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await context.params;
    const { groupName } = await req.json();

    await dbConnect();

    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const updatedGroup = await TravelGroup.findOneAndUpdate(
      { groupID: binaryGroupId, leaderID: userId },
      { $set: { groupName } },
      { new: true },
    ).lean();

    if (!updatedGroup) {
      return NextResponse.json(
        { error: "failed to update: only the leader can do this" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      group: {
        ...updatedGroup,
        groupID: updatedGroup.groupID.toString(),
      },
    });
  } catch (error) {
    console.error("PATCH group error:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await context.params;
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope"); // "trip" | "group"

    await dbConnect();

    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId }).lean();

    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const isLeader = (group as any).leaderID.toString() === userId.toString();
    if (!isLeader) {
      return NextResponse.json(
        { error: "only the leader can delete the group" },
        { status: 403 },
      );
    }

    if (scope === "trip") {
      // Delete the Trip document and all calendar events, keep the group
      await Promise.all([
        Trip.deleteOne({ groupID: groupId }),
        CalendarEvent.deleteMany({ groupId }),
      ]);
      return NextResponse.json({ ok: true, deleted: "trip" });
    }

    // Delete the group, its Trip document, and all calendar events
    await Promise.all([
      Trip.deleteOne({ groupID: groupId }),
      CalendarEvent.deleteMany({ groupId }),
      TravelGroup.deleteOne({ groupID: binaryGroupId }),
    ]);

    return NextResponse.json({ ok: true, deleted: "group" });
  } catch (error) {
    console.error("DELETE group error:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

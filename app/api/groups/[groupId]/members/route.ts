/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    await dbConnect();

    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.userId;
    const sessionUsername =
      (session?.user as any)?.username || (session?.user as any)?.name;

    if (!sessionUserId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // cast groupId string to BSON UUID
    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);

    const group = await TravelGroup.findOne({ groupID: binaryGroupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const currentUserIdStr = sessionUserId.toString();
    const isMember = group.membersList.some(
      (m: any) => m.userId.toString() === currentUserIdStr,
    );

    if (!isMember) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    /**
     * THE FIX:
     * 1. Get all member ID strings
     * 2. Query users. Since UUID matching is failing, we fetch all and filter in JS
     * OR we use the binary IDs explicitly.
     */
    const memberIdStrings = group.membersList.map((m: any) =>
      m.userId.toString(),
    );
    const binaryMemberIds = group.membersList.map(
      (m: any) => new (mongoose.Types as any).UUID(m.userId.toString()),
    );

    const users = await User.find({
      userId: { $in: binaryMemberIds },
    }).lean();

    const mappedMembers = group.membersList.map((m: any) => {
      const memberIdStr = m.userId.toString();

      // find user doc by comparing strings
      const userDoc = users.find(
        (u: any) => u.userId.toString() === memberIdStr,
      );

      // FALLBACK LOGIC: if it's YOU, use your session username if DB lookup failed
      let displayName = "unknown user";
      if (userDoc) {
        displayName = userDoc.username || userDoc.name || displayName;
      } else if (memberIdStr === currentUserIdStr && sessionUsername) {
        displayName = sessionUsername;
      }

      return {
        userId: memberIdStr,
        name: displayName,
        role: m.role,
      };
    });

    return NextResponse.json(
      {
        members: mappedMembers,
        group: {
          ...group,
          groupID: group.groupID.toString(),
          leaderID: group.leaderID.toString(),
          membersList: mappedMembers,
        },
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error("api/groups/members GET error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/**
 * POST, PATCH, and DELETE remain the same as they use the correct binary casting
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    await dbConnect();
    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId });
    if (!group)
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    const { email } = await req.json();
    const targetUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (!targetUser)
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    group.pendingRequests.push({ email: targetUser.email, sentAt: new Date() });
    await group.save();
    return NextResponse.json({ message: "success" }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const session = await getServerSession(authOptions);
    const { targetUserId, newRole } = await req.json();
    await dbConnect();
    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId });
    if (group) {
      const member = group.membersList.find(
        (m: any) => m.userId.toString() === targetUserId.toString(),
      );
      if (member) member.role = newRole;
      await group.save();
    }
    return NextResponse.json({ message: "updated" });
  } catch (err) {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const { userId } = await req.json();
    await dbConnect();
    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId });
    if (group) {
      group.membersList = group.membersList.filter(
        (m: any) => m.userId.toString() !== userId.toString(),
      );
      await group.save();
    }
    return NextResponse.json({ message: "removed" });
  } catch (err) {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

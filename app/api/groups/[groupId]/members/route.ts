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

    const binaryMemberIds = group.membersList.map(
      (m: any) => new (mongoose.Types as any).UUID(m.userId.toString()),
    );

    const users = await User.find({
      userId: { $in: binaryMemberIds },
    }).lean();

    const mappedMembers = group.membersList.map((m: any) => {
      const memberIdStr = m.userId.toString();
      const userDoc = users.find(
        (u: any) => u.userId.toString() === memberIdStr,
      );

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

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    await dbConnect();
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.userId;

    if (!sessionUserId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId });
    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    if (group.leaderID.toString() !== sessionUserId.toString()) {
      return NextResponse.json(
        { error: "only the leader can invite" },
        { status: 403 },
      );
    }

    const { email } = await req.json();
    const targetUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (!targetUser) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const alreadyMember = group.membersList.some(
      (m: any) => m.userId.toString() === targetUser.userId.toString(),
    );
    if (alreadyMember) {
      return NextResponse.json(
        { error: "already in the group" },
        { status: 400 },
      );
    }

    // only track as pending, don't add to membersList until they accept
    const alreadyPending = group.pendingRequests.some(
      (r: any) => r.email.toLowerCase() === email.toLowerCase().trim(),
    );
    if (!alreadyPending) {
      group.pendingRequests.push({
        email: targetUser.email,
        sentAt: new Date(),
      });
    }

    await group.save();

    return NextResponse.json(
      {
        message: "success",
        group: {
          ...group.toObject(),
          groupID: group.groupID.toString(),
          leaderID: group.leaderID.toString(),
          pendingRequests: group.pendingRequests,
        },
      },
      { status: 201 },
    );
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
    await dbConnect();

    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.userId;

    if (!sessionUserId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId });

    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const isMember = group.membersList.some(
      (m: any) => m.userId.toString() === sessionUserId.toString(),
    );
    if (!isMember) {
      return NextResponse.json(
        { error: "you must be a member to invite others" },
        { status: 403 },
      );
    }
    const { targetUserId, newRole, action } = await req.json();

    if (!targetUserId || (!newRole && action !== "TRANSFER_LEADERSHIP")) {
      return NextResponse.json(
        { error: "targetUserId and newRole are required" },
        { status: 400 },
      );
    }

    const requesterMember = group.membersList.find(
      (m: any) => m.userId.toString() === sessionUserId.toString(),
    );
    const isRequesterLeader =
      group.leaderID.toString() === sessionUserId.toString();
    const isRequesterAdmin = requesterMember?.role === "Admin";

    if (action === "TRANSFER_LEADERSHIP") {
      if (!isRequesterLeader) {
        return NextResponse.json(
          { error: "only the leader can transfer leadership" },
          { status: 403 },
        );
      }
      const currentLeader = group.membersList.find(
        (m: any) => m.userId.toString() === sessionUserId.toString(),
      );
      const newLeader = group.membersList.find(
        (m: any) => m.userId.toString() === targetUserId.toString(),
      );
      if (!newLeader) {
        return NextResponse.json(
          { error: "target member not found" },
          { status: 404 },
        );
      }
      if (currentLeader) currentLeader.role = "Admin";
      newLeader.role = "Leader";
      group.leaderID = newLeader.userId;
    } else {
      if (!isRequesterLeader && !isRequesterAdmin) {
        return NextResponse.json(
          { error: "only leaders and admins can change member roles" },
          { status: 403 },
        );
      }
      const member = group.membersList.find(
        (m: any) => m.userId.toString() === targetUserId.toString(),
      );
      if (member && member.role === "Leader") {
        return NextResponse.json(
          {
            error:
              "Cannot change the leader's role directly. Use transfer leadership.",
          },
          { status: 400 },
        );
      }
      // admins cannot demote other admins — only the leader can change admin roles
      if (!isRequesterLeader && isRequesterAdmin && member?.role === "Admin") {
        return NextResponse.json(
          { error: "admins cannot change the role of other admins" },
          { status: 403 },
        );
      }
      if (member) member.role = newRole;
    }

    await group.save();
    return NextResponse.json({ message: "updated" });
  } catch (err) {
    console.error("PATCH members error:", err);
    return NextResponse.json({ error: "SERVER error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUserId = (session?.user as any)?.userId;

    if (!sessionUserId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await context.params;
    await dbConnect();

    const binaryGroupId = new (mongoose.Types as any).UUID(groupId);
    const group = await TravelGroup.findOne({ groupID: binaryGroupId });

    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    // only the leader can remove members or cancel invitations
    if (group.leaderID.toString() !== sessionUserId.toString()) {
      return NextResponse.json(
        { error: "only the leader can perform this action" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { userId, email } = body;

    if (email) {
      // cancel a pending invitation — remove from pendingRequests and membersList
      const lowerEmail = (email as string).toLowerCase().trim();
      group.pendingRequests = group.pendingRequests.filter(
        (r: any) => r.email.toLowerCase() !== lowerEmail,
      );
      const targetUser = await User.findOne({ email: lowerEmail });
      if (targetUser) {
        group.membersList = group.membersList.filter(
          (m: any) => m.userId.toString() !== targetUser.userId.toString(),
        );
      }
    } else if (userId) {
      group.membersList = group.membersList.filter(
        (m: any) => m.userId.toString() !== userId.toString(),
      );
    } else {
      return NextResponse.json(
        { error: "userId or email required" },
        { status: 400 },
      );
    }

    await group.save();
    return NextResponse.json({ message: "removed" });
  } catch (err) {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

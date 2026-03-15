import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";

const addMemberSchema = z
  .object({
    email: z.string().email().optional(),
    userId: z.string().optional(),
  })
  .refine((data) => data.email !== undefined || data.userId !== undefined, {
    message: "either email or userId is required",
  });

/**
 * gets the full roster of a group with usernames and roles.
 * fulfills the requirement for the role management ui.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const group = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const currentUser = await User.findOne({ email: session.user.email });
    if (!currentUser) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    // verify the requester is actually in the group
    const isMember = group.membersList.some(
      (m: any) => m.userId.toString() === currentUser.userId.toString(),
    );

    if (!isMember) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // fetch all usernames in one query for efficiency
    const memberIds = group.membersList.map((m: any) => m.userId);
    const users = await User.find({ userId: { $in: memberIds } }).lean();

    // map database roles and IDs to usernames for the frontend
    const payload = group.membersList.map((m: any) => {
      const userDoc = users.find(
        (u: any) => u.userId.toString() === m.userId.toString(),
      );
      return {
        userId: m.userId.toString(),
        name: userDoc ? userDoc.username : "unknown user",
        role: m.role,
      };
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("api/groups/members GET error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/**
 * invites a new member to the group via email or userId.
 * adds to pendingRequests instead of membersList.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const session = await getServerSession(authOptions);
    const currentUserId = (session?.user as any)?.userId;

    if (!currentUserId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await dbConnect();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    // only the leader or admins are allowed to invite others
    const requester = group.membersList.find(
      (m: any) => m.userId.toString() === currentUserId.toString(),
    );
    if (
      !requester ||
      (requester.role !== "Leader" && requester.role !== "Admin")
    ) {
      return NextResponse.json(
        { error: "forbidden: only the leader and admins can add members" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const validation = addMemberSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "invalid input" },
        { status: 400 },
      );
    }

    // determine target email
    let targetEmail = validation.data.email?.trim().toLowerCase();

    if (!targetEmail && validation.data.userId) {
      const user = await User.findOne({ userId: validation.data.userId })
        .select("email")
        .lean();
      if (user) targetEmail = user.email.toLowerCase();
    }

    if (!targetEmail) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    // check if user is already a member
    const targetUser = await User.findOne({ email: targetEmail }).select(
      "userId",
    );
    if (targetUser) {
      const isAlreadyMember = group.membersList.some(
        (m: any) => m.userId.toString() === targetUser.userId.toString(),
      );
      if (isAlreadyMember) {
        return NextResponse.json(
          { error: "user is already in the group" },
          { status: 400 },
        );
      }
    }

    // check if already invited
    const isAlreadyInvited = group.pendingRequests?.some(
      (req: any) => req.email === targetEmail,
    );
    if (isAlreadyInvited) {
      return NextResponse.json(
        { error: "invitation already pending" },
        { status: 400 },
      );
    }

    // push to pendingRequests instead of membersList
    // this ensures they have to "accept" or visit the group to be added
    const updated = await TravelGroup.findOneAndUpdate(
      { groupID: groupId },
      {
        $push: {
          pendingRequests: {
            email: targetEmail,
            sentAt: new Date(),
          },
        },
      },
      { new: true },
    ).lean();

    return NextResponse.json(
      {
        message: "invitation sent successfully",
        group: {
          groupID: updated.groupID.toString(),
          pendingRequests: updated.pendingRequests,
        },
      },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("api/groups/members POST error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

// handles role updates and leadership transfers
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const session = await getServerSession(authOptions);
    const currentUserId = (session?.user as any)?.userId;

    if (!currentUserId)
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { targetUserId, newRole } = await req.json();
    await dbConnect();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group)
      return NextResponse.json({ error: "group not found" }, { status: 404 });

    // only the leader can change roles or transfer leadership
    if (group.leaderID.toString() !== currentUserId.toString()) {
      return NextResponse.json(
        { error: "forbidden: only the leader can manage roles" },
        { status: 403 },
      );
    }

    if (newRole === "Leader") {
      // transfer leadership: demote current leader to admin, promote target
      const oldLeader = group.membersList.find(
        (m: any) => m.userId.toString() === currentUserId.toString(),
      );
      const newLeader = group.membersList.find(
        (m: any) => m.userId.toString() === targetUserId.toString(),
      );

      if (oldLeader) oldLeader.role = "Admin";
      if (newLeader) newLeader.role = "Leader";
      group.leaderID = targetUserId;
    } else {
      // regular role update
      const member = group.membersList.find(
        (m: any) => m.userId.toString() === targetUserId.toString(),
      );
      if (member) member.role = newRole;
    }

    await group.save();
    return NextResponse.json({ message: "roles updated" });
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
    const session = await getServerSession(authOptions);
    const currentUserId = (session?.user as any)?.userId;

    if (!currentUserId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    await dbConnect();
    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group)
      return NextResponse.json({ error: "group not found" }, { status: 404 });

    // only leader/admin can cancel
    const requester = group.membersList.find(
      (m: any) => m.userId.toString() === currentUserId.toString(),
    );
    if (
      !requester ||
      (requester.role !== "Leader" && requester.role !== "Admin")
    ) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // remove from pendingRequests
    group.pendingRequests = group.pendingRequests.filter(
      (req: any) => req.email !== email.toLowerCase(),
    );
    await group.save();

    return NextResponse.json({ message: "invitation cancelled" });
  } catch (err) {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

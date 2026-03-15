import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import { getMemberPermissions } from "@/lib/roles";

/**
 * handles group role updates and leadership transfers.
 * restricted to the current group leader.
 */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const currentUser = await User.findOne({ email: session.user.email });
    
    if (!currentUser) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    const { targetUserId, newRole, action } = await req.json();

    // check requester's permissions via the lib helper
    const permissionResult = (await getMemberPermissions(
      groupId,
      currentUser.userId,
    )) as any;

    if (permissionResult.error) {
      return NextResponse.json(
        { error: permissionResult.error }, 
        { status: permissionResult.status }
      );
    }

    // ac: verify current user is the group leader
    if (!permissionResult.roles?.isLeader) {
      return NextResponse.json(
        { error: "forbidden: only the leader can manage roles" },
        { status: 403 },
      );
    }

    if (action === "TRANSFER_LEADERSHIP") {
      // ac: transfer 'leader' status and downgrade self to admin
      await TravelGroup.findOneAndUpdate(
        { groupID: groupId },
        {
          $set: {
            leaderID: targetUserId,
            "membersList.$[oldLeader].role": "Admin",
            "membersList.$[newLeader].role": "Leader",
          },
        },
        {
          arrayFilters: [
            { "oldLeader.userId": currentUser.userId },
            { "newLeader.userId": targetUserId },
          ],
        },
      );
    } else {
      // ac: toggle a user between 'admin' and 'viewer' status
      await TravelGroup.findOneAndUpdate(
        { groupID: groupId, "membersList.userId": targetUserId },
        { $set: { "membersList.$.role": newRole } },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("role management error:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
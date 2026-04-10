/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import Vote from "@/models/Vote";
import Pusher from "pusher";
import { getMemberPermissions } from "@/lib/roles";

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * GET /api/groups/:groupId/itinerary/vote?activityIds=id1,id2,...
 * Returns upvote/downvote counts and the calling user's current vote
 * for each requested activityId in a single round-trip.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    await dbConnect();
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const permissions = await getMemberPermissions(groupId, userId);
    if (permissions.status !== 200) {
      return NextResponse.json(
        { error: permissions.error },
        { status: permissions.status },
      );
    }

    const url = new URL(req.url);
    const activityIds = (url.searchParams.get("activityIds") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (activityIds.length === 0) {
      return NextResponse.json({ votes: {} });
    }

    const allVotes = await Vote.find({
      activityId: { $in: activityIds },
      groupId,
    }).lean();

    const votes: Record<
      string,
      { upvotes: number; downvotes: number; userVote: "up" | "down" | null }
    > = {};

    for (const id of activityIds) {
      const forActivity = allVotes.filter((v) => v.activityId === id);
      votes[id] = {
        upvotes: forActivity.filter((v) => v.type === "up").length,
        downvotes: forActivity.filter((v) => v.type === "down").length,
        userVote:
          (forActivity.find((v) => v.userId === userId)?.type as
            | "up"
            | "down"
            | undefined) ?? null,
      };
    }

    return NextResponse.json({ votes });
  } catch (error) {
    console.error("VOTE_GET_ERROR:", error);
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
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const permissions = await getMemberPermissions(groupId, userId);
    if (permissions.status !== 200) {
      return NextResponse.json(
        { error: permissions.error },
        { status: permissions.status },
      );
    }

    const { activityId, type } = await req.json();

    await Vote.findOneAndUpdate(
      { activityId, userId, groupId },
      { type },
      { upsert: true, new: true },
    );

    const upvotes = await Vote.countDocuments({
      activityId,
      groupId,
      type: "up",
    });
    const downvotes = await Vote.countDocuments({
      activityId,
      groupId,
      type: "down",
    });

    await pusher.trigger(`group-${groupId}`, "vote-updated", {
      activityId,
      upvotes,
      downvotes,
    });

    return NextResponse.json({ success: true, upvotes, downvotes });
  } catch (error) {
    console.error("VOTE_POST_ERROR:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    await dbConnect();
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { activityId } = await req.json();

    const permissions = await getMemberPermissions(groupId, userId);
    if (permissions.status !== 200) {
      return NextResponse.json(
        { error: permissions.error },
        { status: permissions.status },
      );
    }

    await Vote.findOneAndDelete({ activityId, userId, groupId });

    const upvotes = await Vote.countDocuments({
      activityId,
      groupId,
      type: "up",
    });
    const downvotes = await Vote.countDocuments({
      activityId,
      groupId,
      type: "down",
    });

    await pusher.trigger(`group-${groupId}`, "vote-updated", {
      activityId,
      upvotes,
      downvotes,
    });

    return NextResponse.json({ success: true, upvotes, downvotes });
  } catch (error: any) {
    return NextResponse.json(
      { error: "server error, message: " + error.message },
      { status: 500 },
    );
  }
}

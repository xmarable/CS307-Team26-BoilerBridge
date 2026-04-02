/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import dbConnect from "@/lib/dbConnect";

export async function POST(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    const myUUID = (session?.user as any)?.userId;
    const body = await req.json();
    const { requestId, senderId } = body;

    if (!myUUID || !senderId) {
      return NextResponse.json({ error: "Missing IDs" }, { status: 400 });
    }

    // Update the request status to accepted
    if (requestId) {
      await FriendRequest.findOneAndUpdate(
        { requestId: requestId },
        { status: "accepted" },
      );
    } else {
      await FriendRequest.findOneAndUpdate(
        { requesterId: senderId, recipientId: myUUID, status: "pending" },
        { status: "accepted" },
      );
    }

    // Add to each other's friendsList strictly via userId string
    await User.findOneAndUpdate(
      { userId: myUUID },
      { $addToSet: { friendsList: senderId } },
    );
    await User.findOneAndUpdate(
      { userId: senderId },
      { $addToSet: { friendsList: myUUID } },
    );

    return NextResponse.json(
      { message: "Friend request accepted" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Accept API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

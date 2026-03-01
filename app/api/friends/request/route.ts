import { NextResponse } from "next/server";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import dbConnect from "@/lib/dbConnect";

export async function POST(req: Request) {
  try {
    await dbConnect();

    const body = await req.json();
    const requesterId = body.requesterId;
    const recipientId = body.recipientId;

    if (!requesterId || !recipientId) {
      return NextResponse.json({ error: "Missing IDs" }, { status: 400 });
    } else {
      const requester = await User.collection.findOne({
        userId: requesterId,
      });
      let isAlreadyFriends = false;

      if (requester) {
        if (requester.friends) {
          if (requester.friends.includes(recipientId)) {
            isAlreadyFriends = true;
          }
        }
      }

      if (isAlreadyFriends) {
        return NextResponse.json({ error: "Already friends" }, { status: 400 });
      } else {
        const existingRequest = await FriendRequest.collection.findOne({
          requesterId: requesterId,
          recipientId: recipientId,
        });

        if (existingRequest) {
          return NextResponse.json(
            { error: "Friend request already exists" },
            { status: 400 },
          );
        } else if (requesterId === recipientId) {
          return NextResponse.json(
            { error: "Cannot send friend request to yourself" },
            { status: 400 },
          );
        } else {
          await FriendRequest.collection.insertOne({
            requesterId: requesterId,
            recipientId: recipientId,
            status: "pending",
            createdAt: new Date(),
          });

          return NextResponse.json(
            { message: "Friend request sent" },
            { status: 200 },
          );
        }
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error: any) {
    console.error("Friend Request API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

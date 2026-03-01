import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import dbConnect from "@/lib/dbConnect";

export async function GET() {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await FriendRequest.find({
      recipientId: session.user.id,
      status: "pending",
    }).lean();

    const formattedRequests = await Promise.all(
      requests.map(async (req: any) => {
        const sender = await User.findOne({
          $or: [{ userId: req.requesterId }, { _id: req.requesterId }],
        })
          .select("username")
          .lean();

        return {
          id: req.requestId || req._id.toString(),
          senderName: sender?.username || "Unknown User",
          requesterId: req.requesterId,
        };
      }),
    );

    return NextResponse.json(formattedRequests, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

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
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const requestId = body.requestId;

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    } else {
      await FriendRequest.deleteOne({
        $or: [{ requestId: requestId }, { _id: requestId }],
      });

      return NextResponse.json(
        { message: "Request declined" },
        { status: 200 },
      );
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

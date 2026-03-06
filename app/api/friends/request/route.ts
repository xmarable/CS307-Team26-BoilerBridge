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
    } else {
      const currentUser = await User.findById(session.user.id);

      if (!currentUser) {
        return NextResponse.json([], { status: 200 });
      } else {
        const requests = await FriendRequest.find({
          recipientId: currentUser.userId,
          status: "pending",
        }).lean();

        const formattedRequests = await Promise.all(
          requests.map(async (req: any) => {
            const sender = await User.findOne({ userId: req.requesterId })
              .select("username")
              .lean();
            return {
              id: req.requestId,
              senderName: sender?.username || "Unknown User",
              requesterId: req.requesterId,
            };
          }),
        );

        return NextResponse.json(formattedRequests, { status: 200 });
      }
    }
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
    const session = await getServerSession(authOptions);
    const body = await req.json();

    const requesterUUID = (session?.user as any)?.userId;
    const recipientId = body.recipientId;

    if (!requesterUUID || !recipientId) {
      console.log("ERROR: Missing IDs in request");
      return NextResponse.json({ error: "Missing IDs" }, { status: 400 });
    } else {
      const requester = await User.findOne({ userId: requesterUUID }).catch(
        (err) => {
          console.log("Mongoose Error finding requester:", err.message);
          return null;
        },
      );

      /* console.log(
        "Database Requester Found:",
        requester ? requester.username : "NULL",
      ); debug print statement */

      if (!requester) {
        return NextResponse.json(
          { error: "User not found or invalid UUID" },
          { status: 404 },
        );
      } else {
        let isAlreadyFriends = false;
        if (
          requester.friendsList &&
          requester.friendsList.includes(recipientId)
        ) {
          isAlreadyFriends = true;
        }

        if (isAlreadyFriends) {
          return NextResponse.json(
            { error: "Already friends" },
            { status: 400 },
          );
        } else if (requesterUUID === recipientId) {
          return NextResponse.json(
            { error: "Cannot send friend request to yourself" },
            { status: 400 },
          );
        } else {
          const incomingRequest = await FriendRequest.findOne({
            requesterId: recipientId,
            recipientId: requesterUUID,
            status: "pending",
          }).catch(() => null);

          if (incomingRequest) {
            // console.log("Mutual request found! Auto-accepting...");

            incomingRequest.status = "accepted";
            await incomingRequest.save();

            await User.findOneAndUpdate(
              { userId: requesterUUID },
              { $addToSet: { friendsList: recipientId } },
            );
            await User.findOneAndUpdate(
              { userId: recipientId },
              { $addToSet: { friendsList: requesterUUID } },
            );

            return NextResponse.json(
              {
                message: "Mutual request found! You are now friends.",
                isAccepted: true,
              },
              { status: 200 },
            );
          }

          const existingRequest = await FriendRequest.findOne({
            requesterId: requesterUUID,
            recipientId: recipientId,
            status: "pending",
          }).catch(() => null);

          if (existingRequest) {
            return NextResponse.json(
              { error: "Friend request already exists" },
              { status: 400 },
            );
          } else {
            const newRequest = await FriendRequest.create({
              requesterId: requesterUUID,
              recipientId: recipientId,
              status: "pending",
            });

            /* console.log(
              "SUCCESS: Created FriendRequest with ID:",
              newRequest.requestId,
            ); debug print statement */

            return NextResponse.json(
              { message: "Friend request sent" },
              { status: 200 },
            );
          }
        }
      }
    }
  } catch (error: any) {
    if (error.name === "CastError") {
      console.log(
        "Final Catch - CastError (Invalid UUID format):",
        error.message,
      );
      return NextResponse.json(
        { error: "Invalid ID format (UUID expected)" },
        { status: 400 },
      );
    }
    console.error("Friend Request API Error:", error);
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
      await FriendRequest.deleteOne({ requestId: requestId });
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

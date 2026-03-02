import { NextResponse } from "next/server";
import FriendRequest from "@/models/FriendRequest";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";

export async function PATCH(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const requestId = body.requestId;

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    } else {
      const friendRequest = await FriendRequest.findOne({
        requestId: requestId,
      });

      if (!friendRequest) {
        return NextResponse.json(
          { error: "Friend request not found" },
          { status: 404 },
        );
      } else {
        friendRequest.status = "accepted";
        await friendRequest.save();

        await User.findOneAndUpdate(
          { userId: friendRequest.requesterId },
          { $addToSet: { friendsList: friendRequest.recipientId } },
        );

        await User.findOneAndUpdate(
          { userId: friendRequest.recipientId },
          { $addToSet: { friendsList: friendRequest.requesterId } },
        );

        return NextResponse.json(
          { message: "Friend request accepted" },
          { status: 200 },
        );
      }
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

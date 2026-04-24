/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

async function handleAccept(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const myUUIDStr = (session?.user as any)?.userId;

    if (!myUUIDStr) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    let senderIdStr = body.senderId || body.requesterId;
    const requestId = body.requestId;

    const myBinaryUUID = new (mongoose.Types as any).UUID(myUUIDStr);

    // FIX FOR 400: If senderId is missing but we have requestId, look it up in the DB
    if (!senderIdStr && requestId) {
      const binaryReqId = new (mongoose.Types as any).UUID(requestId);
      const existingReq = await FriendRequest.findOne({
        requestId: binaryReqId,
      }).lean();

      if (existingReq) {
        // use the requesterId from the stored request as the senderId
        senderIdStr = existingReq.requesterId.toString();
      }
    }

    // if after lookup it's still missing, then we actually have a problem
    if (!senderIdStr) {
      console.error(
        "400 Error: Could not resolve senderId from body or DB",
        body,
      );
      return NextResponse.json({ error: "Missing senderId" }, { status: 400 });
    }

    const senderBinaryUUID = new (mongoose.Types as any).UUID(senderIdStr);

    // 1. update the request status to accepted
    if (requestId) {
      const binaryReqId = new (mongoose.Types as any).UUID(requestId);
      await FriendRequest.findOneAndUpdate(
        { requestId: binaryReqId },
        { status: "accepted" },
      );
    } else {
      await FriendRequest.findOneAndUpdate(
        {
          requesterId: senderBinaryUUID,
          recipientId: myBinaryUUID,
          status: "pending",
        },
        { status: "accepted" },
      );
    }

    // 2. add to each other's friendsList strictly via binary UUIDs
    const updateMe = await User.findOneAndUpdate(
      { userId: myBinaryUUID },
      { $addToSet: { friendsList: senderBinaryUUID } },
      { new: true },
    );

    const updateSender = await User.findOneAndUpdate(
      { userId: senderBinaryUUID },
      { $addToSet: { friendsList: myBinaryUUID } },
      { new: true },
    );

    if (!updateMe || !updateSender) {
      return NextResponse.json({ error: "Users not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Friend request accepted" },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Accept API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  return handleAccept(req);
}

export async function PATCH(req: Request) {
  return handleAccept(req);
}

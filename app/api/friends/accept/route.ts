import { NextResponse } from "next/server";
import FriendRequest from "@/models/FriendRequest";
import User from "@/models/User";

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const requestId = body.requestId;

        if (!requestId) {
            return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
        } else {
            const friendRequest = await FriendRequest.findOne({ requestId: requestId });

            if (!friendRequest) {
                return NextResponse.json({ error: "Friend request not found" }, { status: 404 });
            } else {
                friendRequest.status = "accepted";
                await friendRequest.save();

                await User.findOneAndUpdate(
                    { userId: friendRequest.requesterId },
                    { $addToSet: { friendsList: friendRequest.recipientId } }
                );

                return NextResponse.json({ message: "Friend request accepted" }, { status: 200 });
            }
        }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
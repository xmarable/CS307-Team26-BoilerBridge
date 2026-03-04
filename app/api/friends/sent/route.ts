import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import FriendRequest from "@/models/FriendRequest";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";

export async function GET() {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const myUUID = (session?.user as any)?.userId;

    if (!myUUID)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sentRequests = await FriendRequest.find({
      requesterId: myUUID,
      status: "pending",
    }).lean();

    const formattedRequests = await Promise.all(
      sentRequests.map(async (req: any) => {
        const recipient = await User.findOne({ userId: req.recipientId })
          .select("username email")
          .lean();
        return {
          id: req.requestId,
          recipientName: recipient?.username || "Unknown User",
          recipientEmail: recipient?.email,
          createdAt: req.createdAt,
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

export const dynamic = "force-dynamic";

import { Friends } from "@/components/Friends";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import User from "@/models/User";
import FriendRequest from "@/models/FriendRequest";
import dbConnect from "@/lib/dbConnect";

export default async function FriendsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/signin");
    return null;
  }

  await dbConnect();
  const myUUID = (session.user as any).userId;

  // Fetch all social data in parallel on the server
  const [userDoc, sentRequestsRaw, inboundRequestsRaw] = await Promise.all([
    User.findOne({ userId: myUUID }).select("friendsList").lean(),
    FriendRequest.find({ requesterId: myUUID, status: "pending" }).lean(),
    FriendRequest.find({ recipientId: myUUID, status: "pending" }).lean(),
  ]);

  const friends = userDoc?.friendsList?.length
    ? await User.find({ userId: { $in: userDoc.friendsList } })
        .select("username email userId school")
        .lean()
    : [];

  const sentRequests = await Promise.all(
    sentRequestsRaw.map(async (req: any) => {
      const recipient = await User.findOne({ userId: req.recipientId })
        .select("username email")
        .lean();
      return {
        id: req.requestId || req._id.toString(),
        recipientName: recipient?.username || "Unknown",
        recipientEmail: recipient?.email || "",
        createdAt: req.createdAt
          ? req.createdAt.toISOString()
          : new Date().toISOString(),
      };
    }),
  );

  const inboundRequests = await Promise.all(
    inboundRequestsRaw.map(async (req: any) => {
      const sender = await User.findOne({ userId: req.requesterId })
        .select("username email userId")
        .lean();
      return {
        id: req.requestId || req._id.toString(),
        senderId: sender?.userId || "",
        senderName: sender?.username || "Unknown",
        senderEmail: sender?.email || "",
        createdAt: req.createdAt
          ? req.createdAt.toISOString()
          : new Date().toISOString(),
      };
    }),
  );

  const initialData = JSON.parse(
    JSON.stringify({ friends, sentRequests, inboundRequests }),
  );

  return <Friends initialData={initialData} />;
}

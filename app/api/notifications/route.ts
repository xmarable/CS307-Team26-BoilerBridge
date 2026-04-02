import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Notification from "@/models/Notification";

const MAX_LIMIT = 50;

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
    const limitRaw = parseInt(url.searchParams.get("limit") ?? "20", 10) || 20;
    const limit = Math.min(Math.max(1, limitRaw), MAX_LIMIT);
    const skip = (page - 1) * limit;

    await dbConnect();

    const recipientID = userId.toString();

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ recipientID })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ recipientID }),
      Notification.countDocuments({ recipientID, read: false }),
    ]);

    const body = notifications.map((n) => ({
      notificationID: String(n.notificationID),
      recipientID: String(n.recipientID),
      type: String(n.type),
      groupID: String(n.groupID),
      paymentRequestID: String(n.paymentRequestID),
      actorUserId:
        n.actorUserId != null ? String(n.actorUserId) : undefined,
      amountDollars:
        n.amountDollars != null ? Number(n.amountDollars) : undefined,
      message: n.message != null ? String(n.message) : undefined,
      read: Boolean(n.read),
      createdAt: n.createdAt,
    }));

    return NextResponse.json({
      notifications: body,
      total,
      page,
      limit,
      unreadCount,
    });
  } catch (err) {
    console.error("GET notifications error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

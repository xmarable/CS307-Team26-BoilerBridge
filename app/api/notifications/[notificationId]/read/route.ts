import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import Notification from "@/models/Notification";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { notificationId } = await params;
    if (!notificationId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    await dbConnect();

    const recipientID = userId.toString();

    const doc = await Notification.findOneAndUpdate(
      {
        notificationID: notificationId,
        recipientID,
      },
      { read: true },
      { new: true },
    ).lean();

    if (!doc) {
      return NextResponse.json({ error: "notification not found" }, { status: 404 });
    }

    return NextResponse.json({
      notification: {
        notificationID: String(doc.notificationID),
        read: Boolean(doc.read),
      },
    });
  } catch (err) {
    console.error("PATCH notification read error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

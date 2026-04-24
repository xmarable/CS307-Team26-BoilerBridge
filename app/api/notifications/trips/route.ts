import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import Notification from "@/models/Notification";

export async function GET() {
    const session = await getServerSession(authOptions);
    
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.userId;

    await dbConnect();

    const notifications = await Notification.find({
        recipientID: userId,
        type: "trip",
        read: false
    }).sort({ createdAt: -1 }).limit(20);

    return NextResponse.json({
        notifications: notifications.map((n) => ({
            notificationID: n.notificationID,
            groupID: n.groupID,
            recipient: userId,
            message: n.message,
            createdAt: n.createdAt
        }))
    }, { status: 200 });
}
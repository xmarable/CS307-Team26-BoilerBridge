import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import z from "zod";

const MessageSchema = z.object({
    content: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message too long")
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
    // Verify user logged in
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "unauthorized"}, { status: 401 });
    }

    // Verify user exists
    await dbConnect();
    const user = await User.findOne({ userId: userId });

    if (!user) {
        return NextResponse.json({ error: "Unauthorized"}, { status: 401 });
    }

    // Find group from id
    const { groupId } = await params;    
    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Verify user in member list
    const members = group?.membersList ?? [];
    if (!members.includes(userId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify json data is formatted correct
    const body = await req.json();
    const message = MessageSchema.safeParse(body);
    if (!message.success) {
        return NextResponse.json(
            { error: "Invalid Message", details: message.error.flatten() },
            { status: 400 }
        );
    }

    const newMessage = group.chatLogs.create({
        senderID: userId,
        content: message.data.content
    });

    group.chatLogs.push(newMessage);
    await group.save();

    return NextResponse.json({ message: newMessage }, { status: 201 });
}
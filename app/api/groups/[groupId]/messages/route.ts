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

async function verifyUser(params: Promise<any>) {
    // Verify user logged in
    const session = await getServerSession(authOptions);
    const mongoId = (session?.user as any)?.id as string | undefined;
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
        return null;
    }

    // Verify user exists
    await dbConnect();
    const user = await User.findOne({ userId: userId });

    if (!user) {
        return null;
    }

    // Find group from id
    const { groupId } = await params;    
    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
        return null;
    }

    // Verify user in member list
    const members = group?.membersList ?? [];
    if (!members.includes(mongoId)) {
        return null;
    }

    return { group, userId: userId };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
    // Get group and userId info
    const info = await verifyUser(params);

    if (!info) {
        return NextResponse.json({ error: "Unauthorized"}, { status: 401 });
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

    const newMessage = {
        senderID: info.userId,
        content: message.data.content
    };

    info.group.chatLogs.push(newMessage as any);
    await info.group.save();

    return NextResponse.json({ message: newMessage }, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: String}> }) {
    // Verify user logged in
    const info = await verifyUser(params);
    
    if (!info) {
        return NextResponse.json({ error: "Unauthorized"}, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = 50;

    const before = url.searchParams.get("before");
    const logs = info.group.chatLogs ?? [];

    // Make sure chat logs are sorted in ascending order
    logs.sort((ma: any, mb: any) => {
        const ta = new Date(ma.timestamp).getTime();
        const tb = new Date(mb.timestamp).getTime();
        return ta-tb;
    });

    let e_Index = logs.length;

    if (before) {
        const beforeTime = new Date(before).getTime();

        e_Index = logs.findIndex((message: any) => new Date(message.timestamp).getTime() >= beforeTime);

        if (e_Index = -1) {
            e_Index = logs.length;
        }
    }

    const s_index = Math.max(0, e_Index - 50);
    const messages = logs.slice(s_index, e_Index);

    return NextResponse.json(
        {
            messages: messages,
            nextbefore: messages[0]?.timestamp || null,
            hasMore: s_index > 0
        },
        { status: 200 }
    );
}
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const MessageSchema = z.object({
    content: z.string().trim().min(1, "Message cannot be empty").max(500, "Message too long")
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: String }>}) {
    const session = await getServerSession(authOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session?.user as any)?.userId as string | undefined;
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findOne({ userId: userId });
    if (!user) {
        return NextResponse.json({ error: "Unauthorized"}, { status: 401});
    }

    const { groupId } = await params;
    const group = await TravelGroup.findOne({ groupID: groupId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!group.membersList.some((m: any) => m.userId.toString() === userId && m.role === "Leader")) {
        return NextResponse.json({ error: "Unauthorized"}, { status: 401});
    }

    const body = await req.json();
    const message = MessageSchema.safeParse(body);
    if (!message.success) {
        return NextResponse.json(
            { error: "Invalid Message", details: message.error.flatten()},
            { status: 400 }
        );
    }

    const newSMS = {
        topic: "yes"
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    group.smsLogs.push(newSMS as any);
    await group.save();

    // TODO send sms' with twilio


    return NextResponse.json({ message: "Success" }, { status: 201 });
}
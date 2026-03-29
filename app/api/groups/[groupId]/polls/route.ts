import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const PollSchema = z.object({
    choices: z.array(z.string()).min(2),
    endsAt: z.coerce.date().refine((d) => d.getTime() >= Date.now() + 10 * 60 * 1000, {
        message: "Date must be at least 10 min in the future"
    })
});

const PollDeleteSchema = z.object({
    pollId: z.uuid()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyUser(params: Promise<any>) {
    // Verify user logged in
    const session = await getServerSession(authOptions);
    const userId = (session?.user)?.userId as string | undefined;
    if (!userId) {
        return null;
    }
    console.log(userId);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!group.membersList.some((m: any) => m.userId.toString() === userId)) {
        return null;
    }

    return { group, userId: userId, username: user?.username };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }>}) {
    const info = await verifyUser(params);

    if (!info) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const poll = PollSchema.safeParse(body);
    if (!poll.success) {
        return NextResponse.json(
            { error: "Invalid Poll", details: poll.error?.flatten()},
            { status: 400}
        )
    }

    const newPoll = {
        createdBy: info.userId,
        choices: poll.data.choices,
        endsAt: poll.data.endsAt
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    info.group.polls.push(newPoll as any);
    await info.group.save();

    return NextResponse.json({ message: newPoll }, { status: 200 });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }>}) {
    const info = await verifyUser(params);

    if (!info) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const polls = info.group.polls;
    return NextResponse.json({ polls: polls }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ groupId: string }>}) {
    
}
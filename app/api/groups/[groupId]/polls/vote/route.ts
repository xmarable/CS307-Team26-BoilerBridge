import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const VoteSchema = z.object({
    pollId: z.uuid(),
    choiceIndex: z.number().int().min(0),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyUser(params: Promise<any>) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user)?.userId as string | undefined;

    if (!userId) {
        return null;
    }

    await dbConnect();

    const user = await User.findOne({ userId });
    if (!user) {
        return null;
    }

    const { groupId } = await params;
    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!group.membersList.some((m: any) => m.userId.toString() === userId)) {
        return null;
    }

    return { group, userId };
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ groupId: string }> }
) {
    const info = await verifyUser(params);

    if (!info) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = VoteSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid vote", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { pollId, choiceIndex } = parsed.data;

    const polls = info.group.polls ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const poll = polls.find((p: any) => p.pollId.toString() === pollId);

    if (!poll) {
        return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    }

    if (new Date(poll.endsAt).getTime() < Date.now()) {
        return NextResponse.json({ error: "Poll has ended" }, { status: 400 });
    }

    if (!poll.choices || choiceIndex >= poll.choices.length) {
        return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
    }

    poll.choices[choiceIndex].count += 1;

    await info.group.save();

    return NextResponse.json({ poll }, { status: 200 });
}
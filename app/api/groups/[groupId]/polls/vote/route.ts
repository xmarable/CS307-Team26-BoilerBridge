import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import z from "zod";

const VoteSchema = z.object({
    pollId: z.uuid(),
    choiceIndex: z.number().int().min(0).nullable(),
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

    const currentChoice = poll.choices.findIndex((choice: any) => (choice.voters ?? []).some((voterId: any) => voterId.toString() === info.userId));

    if (choiceIndex === null) {
        if (currentChoice === -1) {
            return NextResponse.json({ error: "No vote to remove" }, { status: 400 });
        }

        poll.choices[currentChoice].voters =
            (poll.choices[currentChoice].voters ?? []).filter(
                (voterId: any) => voterId.toString() !== info.userId
        );

        poll.choices[currentChoice].count = poll.choices[currentChoice].voters.length;

        await info.group.save();
        return NextResponse.json({ poll, removed: true }, { status: 200 });
    }

    if (!poll.choices || choiceIndex >= poll.choices.length) {
        return NextResponse.json({ error: "Invalid choice" }, { status: 400 });
    }

    if (currentChoice === choiceIndex) {
        poll.choices[choiceIndex].voters = poll.choices[choiceIndex].voters.filter(
            (voter: any) => voter.toString() !== info.userId
        );
        poll.choices[choiceIndex].count = Math.max(0, poll.choices[choiceIndex].voters.length);
        await info.group.save();
        return NextResponse.json({ poll: poll, removed: true }, { status: 200 });
    }

    if (currentChoice !== -1) {
        poll.choices[currentChoice].voters = poll.choices[currentChoice].voters.filter(
            (voter: any) => voter.toString() !== info.userId
        );
        poll.choices[currentChoice].count = poll.choices[currentChoice].voters.length;
    }

    poll.choices[choiceIndex].voters.push(info.userId);
    poll.choices[choiceIndex].count = poll.choices[choiceIndex].voters.length;

    await info.group.save();

    return NextResponse.json({ poll, removed: false }, { status: 200 });
}
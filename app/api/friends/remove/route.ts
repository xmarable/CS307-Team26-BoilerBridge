import {NextResponse} from "next/server";
import User from "@/models/User";

export async function DELETE(req: Request) {
    try {
        const body = await req.json();
        const userOneId = body.userOneId;
        const userTwoId = body.userTwoId;

        if (!userOneId || !userTwoId) {
            return NextResponse.json({ error: "Missing user IDs" }, { status: 400 });
        } else if (userOneId === userTwoId) {
            return NextResponse.json({ error: "Invalid Operation" }, { status: 400 });
        } else {
            await User.findOneAndUpdate(
                { userId: userOneId },
                { $pull: { friendsList: userTwoId } }
            );

            await User.findOneAndUpdate(
                { userId: userTwoId },
                { $pull: { friendsList: userOneId } }
            );

            return NextResponse.json({ message: "Friend removed" }, { status: 200 });
        }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
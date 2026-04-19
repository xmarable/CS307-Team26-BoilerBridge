import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import Itenerary from "@/models/Itenerary";

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
    const session = await getServerSession(authOptions);
    const userId = (session?.user)?.userId as string | undefined;

    if (!session || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const user = await User.findOne({ userId: userId });
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (!group.membersList.som((m: any) => m.userId.toString() === userId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const shareToken = randomBytes(8).toString("base64url");
    const itenerary = await Itenerary.findOne({ iteneraryID: group.iteneraryId });
    if (!itenerary) {
        // TODO create temp for testing
    }

    itenerary.token = shareToken;
    await itenerary.save();

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const url = `${baseUrl}/dashboard/groups/${groupId}/itenerary/shared?token=${shareToken}`;

    return NextResponse.json({ url: url }, { status: 200 });
}
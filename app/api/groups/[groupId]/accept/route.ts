import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    await dbConnect();

    const session = await getServerSession(authOptions);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userId = (session?.user as any)?.userId;
    const email = session?.user?.email?.toLowerCase();

    if (!userId || !email) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // atomic update: pull from pending and push to membersList
    const result = await TravelGroup.findOneAndUpdate(
      {
        groupID: groupId,
        "pendingRequests.email": email,
      },
      {
        $pull: { pendingRequests: { email: email } },
        $push: { membersList: { userId: userId, role: "Viewer" } },
      },
      { new: true },
    );

    if (!result) {
      return NextResponse.json({ error: "invite not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "joined group" }, { status: 200 });
  } catch (err) {
    console.error("accept invite error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

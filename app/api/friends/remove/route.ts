import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);

    const myUUID = (session?.user as any)?.userId;

    const body = await req.json();
    const friendId = body.friendId;

    const userOneId = myUUID;
    const userTwoId = friendId;

    if (!userOneId || !userTwoId) {
      return NextResponse.json({ error: "Missing user IDs" }, { status: 400 });
    } else if (userOneId === userTwoId) {
      return NextResponse.json({ error: "Invalid Operation" }, { status: 400 });
    } else {
      await User.findOneAndUpdate(
        { $or: [{ userId: userOneId }, { userId: userOneId }] },
        { $pull: { friendsList: userTwoId } },
      );

      await User.findOneAndUpdate(
        { $or: [{ userId: userTwoId }, { userId: userTwoId }] },
        { $pull: { friendsList: userOneId } },
      );

      return NextResponse.json({ message: "Friend removed" }, { status: 200 });
    }
  } catch (error: any) {
    console.log("Error message: ", error.message);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

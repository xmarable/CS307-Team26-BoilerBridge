import { NextResponse } from "next/server";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";

export async function DELETE(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const userOneId = body.userOneId;
    const userTwoId = body.userTwoId;

    if (!userOneId || !userTwoId) {
      return NextResponse.json({ error: "Missing user IDs" }, { status: 400 });
    } else if (userOneId === userTwoId) {
      return NextResponse.json({ error: "Invalid Operation" }, { status: 400 });
    } else {
      await User.findOneAndUpdate(
        { $or: [{ userId: userOneId }, { _id: userOneId }] },
        { $pull: { friendsList: userTwoId } },
      );

      await User.findOneAndUpdate(
        { $or: [{ userId: userTwoId }, { _id: userTwoId }] },
        { $pull: { friendsList: userOneId } },
      );

      return NextResponse.json({ message: "Friend removed" }, { status: 200 });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

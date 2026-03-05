import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import User from "@/models/User";
import dbConnect from "@/lib/dbConnect";

export async function GET() {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const myUUID = (session?.user as any)?.userId;

    if (!myUUID)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await User.findOne({ userId: myUUID }).select("friendsList");

    if (!user || !user.friendsList || user.friendsList.length === 0) {
      return NextResponse.json([]);
    }

    const friends = await User.find({
      userId: { $in: user.friendsList },
    })
      .select("username userId email school")
      .lean();

    return NextResponse.json(friends);
  } catch (error) {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

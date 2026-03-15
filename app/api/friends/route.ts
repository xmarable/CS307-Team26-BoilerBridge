import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await dbConnect();

    // Get the current user's friends list
    const currentUser = await User.findOne({
      email: session.user.email,
    }).select("friendsList");

    if (
      !currentUser ||
      !currentUser.friendsList ||
      currentUser.friendsList.length === 0
    ) {
      return NextResponse.json({ friends: [] });
    }

    // Fetch the actual user documents for everyone in that list
    const friends = await User.find({
      userId: { $in: currentUser.friendsList },
    }).select("userId username email");

    return NextResponse.json({ friends });
  } catch (err) {
    console.error("GET /api/friends error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    const email = session?.user?.email?.toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // find groups where u are invited but not a member yet
    const invites = await TravelGroup.find({
      "pendingRequests.email": email,
    })
      .select("groupID groupName description")
      .lean();

    return NextResponse.json(invites || [], { status: 200 });
  } catch (err) {
    console.error("fetch invites error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

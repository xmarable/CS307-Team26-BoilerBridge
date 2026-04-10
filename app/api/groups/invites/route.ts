import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

export async function GET(
  _req: NextRequest,
): Promise<NextResponse<{ invites: any[] } | { error: string }>> {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    const emailRaw = session?.user?.email;
    if (!emailRaw) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const email = emailRaw.toLowerCase();

    const invites = await TravelGroup.find({
      "pendingRequests.email": email,
    })
      .select("groupID groupName description")
      .lean();

    // return NextResponse.json(invites || [], { status: 200 });
    return NextResponse.json(
      { invites: invites ?? [] },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("fetch invites error:", err);
    return NextResponse.json(
      { error: "server error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

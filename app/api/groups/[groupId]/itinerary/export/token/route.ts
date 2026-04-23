import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomBytes } from "crypto";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import { getMemberPermissions } from "@/lib/roles";

/**
 * Ensures a long-lived subscription token exists for calendar export (ics feed).
 * Members only. Returns absolute subscriptionUrl for calendar apps.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "Group ID required" }, { status: 400 });
    }

    await dbConnect();

    const perm = await getMemberPermissions(groupId, userId);
    if (perm.status !== 200) {
      return NextResponse.json(
        { error: perm.error },
        { status: perm.status },
      );
    }

    let token = perm.group.calendarExportToken as string | undefined;
    if (!token) {
      token = randomBytes(32).toString("base64url");
      perm.group.set("calendarExportToken", token);
      await perm.group.save();
    }

    const origin = new URL(req.url).origin;
    const subscriptionUrl = `${origin}/api/groups/${groupId}/itinerary/export/ics?token=${encodeURIComponent(token)}`;

    return NextResponse.json({ subscriptionUrl });
  } catch (e) {
    console.error("POST calendar export token:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import { confirmPaymentRequestInGroup } from "@/lib/confirmPaymentRequestServer";

function isMember(
  group: { membersList: { userId: { toString(): string } }[] },
  uid: string,
): boolean {
  return group.membersList.some((m) => m.userId.toString() === uid);
}

export async function POST(
  _req: Request,
  {
    params,
  }: { params: Promise<{ groupId: string; requestId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId, requestId } = await params;
    if (!groupId || !requestId) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }

    await dbConnect();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const uid = userId.toString();
    if (!isMember(group, uid)) {
      return NextResponse.json(
        { error: "Access denied. You do not have access to this group." },
        { status: 403 },
      );
    }

    const result = await confirmPaymentRequestInGroup(
      group,
      requestId,
      uid,
    );
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({ paymentRequest: result.paymentRequest });
  } catch (err) {
    console.error("POST payment-requests confirm error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

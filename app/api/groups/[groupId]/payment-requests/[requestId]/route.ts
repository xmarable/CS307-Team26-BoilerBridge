import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";

const patchBodySchema = z.object({
  status: z.enum(["declined", "paid"]),
  reason: z.string().trim().max(500).optional(),
});

function isMember(
  group: { membersList: { userId: { toString(): string } }[] },
  uid: string,
): boolean {
  return group.membersList.some((m) => m.userId.toString() === uid);
}

export async function PATCH(
  req: Request,
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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const parsed = patchBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { status: nextStatus, reason } = parsed.data;

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

    const requests = group.paymentRequests ?? [];
    const idx = requests.findIndex((p: { requestID?: unknown }) => {
      return String(p.requestID) === requestId;
    });
    if (idx === -1) {
      return NextResponse.json(
        { error: "payment request not found" },
        { status: 404 },
      );
    }

    const pr = requests[idx] as {
      status?: string;
      targetMemberID?: { toString(): string };
      requesterID?: { toString(): string };
    };

    if (String(pr.targetMemberID) !== uid) {
      return NextResponse.json(
        { error: "Only the target member can update this request" },
        { status: 403 },
      );
    }

    if (String(pr.status) !== "pending") {
      return NextResponse.json(
        { error: "Request is no longer pending" },
        { status: 400 },
      );
    }

    if (nextStatus === "declined") {
      (requests[idx] as { status: string; declineReason?: string }).status =
        "declined";
      if (reason != null && reason.length > 0) {
        (requests[idx] as { declineReason?: string }).declineReason = reason;
      }
    } else {
      (requests[idx] as { status: string }).status = "paid";
    }

    group.markModified("paymentRequests");
    await group.save();

    const updated = requests[idx] as Record<string, unknown>;
    return NextResponse.json({
      paymentRequest: {
        requestID: String(updated.requestID),
        requesterID: String(updated.requesterID),
        targetMemberID: String(updated.targetMemberID),
        amount: Number(updated.amount),
        expenseID: String(updated.expenseID),
        status: String(updated.status),
        createdAt: updated.createdAt,
        message:
          updated.message != null ? String(updated.message) : undefined,
        declineReason:
          updated.declineReason != null
            ? String(updated.declineReason)
            : undefined,
      },
    });
  } catch (err) {
    console.error("PATCH payment-requests error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

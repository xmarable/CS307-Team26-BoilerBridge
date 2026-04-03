import type { Document } from "mongoose";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { applyConfirmedPaymentToExpense } from "@/lib/confirmPaymentLedger";
import type { LedgerExpenseMutable } from "@/lib/confirmPaymentLedger";

export type SerializedPaymentRequest = {
  requestID: string;
  requesterID: string;
  targetMemberID: string;
  amount: number;
  expenseID: string;
  status: string;
  createdAt: unknown;
  confirmedAt?: string;
  message?: string;
  declineReason?: string;
};

export function serializePaymentRequest(
  updated: Record<string, unknown>,
): SerializedPaymentRequest {
  return {
    requestID: String(updated.requestID),
    requesterID: String(updated.requesterID),
    targetMemberID: String(updated.targetMemberID),
    amount: Number(updated.amount),
    expenseID: String(updated.expenseID),
    status: String(updated.status),
    createdAt: updated.createdAt,
    ...(updated.confirmedAt != null
      ? { confirmedAt: new Date(updated.confirmedAt as Date).toISOString() }
      : {}),
    message:
      updated.message != null ? String(updated.message) : undefined,
    declineReason:
      updated.declineReason != null
        ? String(updated.declineReason)
        : undefined,
  };
}

async function displayNameForUser(userId: string): Promise<string> {
  const u = await User.findOne({ userId })
    .select("username name email")
    .lean();
  if (!u) return userId;
  const row = u as { username?: string; name?: string; email?: string };
  return (
    (row.username && String(row.username)) ||
    (row.name && String(row.name)) ||
    (row.email && String(row.email)) ||
    userId
  );
}

/**
 * Target member confirms they paid the requester. Updates request, ledger, and notifies requester.
 */
export async function confirmPaymentRequestInGroup(
  group: Document & {
    ledger?: unknown[];
    paymentRequests?: unknown[];
    groupID?: unknown;
  },
  requestId: string,
  actorUserId: string,
): Promise<
  | { ok: true; paymentRequest: SerializedPaymentRequest }
  | { ok: false; status: number; error: string }
> {
  const uid = actorUserId.toString();
  const requests = (group.paymentRequests ?? []) as Array<
    Record<string, unknown>
  >;
  const idx = requests.findIndex(
    (p) => String(p.requestID) === requestId,
  );
  if (idx === -1) {
    return { ok: false, status: 404, error: "payment request not found" };
  }

  const pr = requests[idx] as {
    status?: string;
    targetMemberID?: { toString(): string };
    requesterID?: { toString(): string };
    amount?: number;
    expenseID?: { toString(): string };
  };

  if (String(pr.targetMemberID) !== uid) {
    return {
      ok: false,
      status: 403,
      error: "Only the target member can update this request",
    };
  }

  if (String(pr.status) === "paid") {
    return {
      ok: false,
      status: 400,
      error: "Payment already confirmed",
    };
  }

  if (String(pr.status) === "declined") {
    return {
      ok: false,
      status: 400,
      error: "Cannot confirm a declined payment request",
    };
  }

  const expenseIDStr = String(pr.expenseID);
  const amount = Number(pr.amount);
  const requesterID = String(pr.requesterID);
  const targetID = String(pr.targetMemberID);

  (requests[idx] as { status: string; confirmedAt?: Date }).status = "paid";
  (requests[idx] as { confirmedAt?: Date }).confirmedAt = new Date();

  const ledger = (group.ledger ?? []) as LedgerExpenseMutable[];
  const expIdx = ledger.findIndex(
    (e) =>
      e.expenseID != null && String(e.expenseID) === expenseIDStr,
  );
  if (expIdx >= 0) {
    applyConfirmedPaymentToExpense(ledger[expIdx]!, targetID, amount);
  }

  group.markModified("paymentRequests");
  group.markModified("ledger");

  await group.save();

  const actorName = await displayNameForUser(targetID);
  const message = `${actorName} has confirmed payment of $${amount.toFixed(2)}`;

  await Notification.create({
    recipientID: requesterID,
    type: "payment_confirmed",
    groupID: String(group.groupID),
    paymentRequestID: requestId,
    actorUserId: targetID,
    amountDollars: amount,
    message,
    read: false,
    createdAt: new Date(),
  });

  const updated = requests[idx] as Record<string, unknown>;
  return {
    ok: true,
    paymentRequest: serializePaymentRequest(updated),
  };
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { z } from "zod";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import {
  dollarsToCents,
  filterExpensesByStatus,
  normalizeLedgerExpenses,
} from "@/lib/ledgerSummary";
import {
  debtorShareOnExpenseCents,
} from "@/lib/paymentRequestLedger";

const postBodySchema = z.object({
  expenseID: z.string().uuid(),
  targetMemberID: z.string().uuid(),
  amount: z.number().positive("Amount must be positive"),
  message: z.string().trim().max(500).optional(),
});

const AMOUNT_EXCEEDS = "Amount exceeds outstanding balance";

function memberIds(
  group: { membersList: { userId: { toString(): string } }[] },
): string[] {
  return group.membersList.map((m) => m.userId.toString());
}

function isMember(
  group: { membersList: { userId: { toString(): string } }[] },
  uid: string,
): boolean {
  return group.membersList.some((m) => m.userId.toString() === uid);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const filter = url.searchParams.get("filter");
    const statusParams = url.searchParams.getAll("status");
    const statusSet =
      statusParams.length > 0
        ? new Set(
            statusParams.filter((s): s is "pending" | "paid" | "declined" =>
              s === "pending" || s === "paid" || s === "declined",
            ),
          )
        : null;

    await dbConnect();

    const groupDoc = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!groupDoc) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const uid = userId.toString();
    if (!isMember(groupDoc as never, uid)) {
      return NextResponse.json(
        { error: "Access denied. You do not have access to this group." },
        { status: 403 },
      );
    }

    const raw = (groupDoc as { paymentRequests?: unknown[] }).paymentRequests ?? [];
    let list = raw.map((p: unknown) => {
      const row = p as Record<string, unknown>;
      return {
      requestID: String(row.requestID),
      requesterID: String(row.requesterID),
      targetMemberID: String(row.targetMemberID),
      amount: Number(row.amount),
      expenseID: String(row.expenseID),
      status: String(row.status) as "pending" | "paid" | "declined",
      createdAt: row.createdAt,
      message: row.message != null ? String(row.message) : undefined,
      declineReason:
        row.declineReason != null ? String(row.declineReason) : undefined,
    };
    });

    if (statusSet && statusSet.size > 0) {
      list = list.filter((r) => statusSet.has(r.status));
    }

    if (filter === "sent") {
      list = list.filter((r) => r.requesterID === uid);
    } else if (filter === "received") {
      list = list.filter((r) => r.targetMemberID === uid);
    }

    const idSet = new Set<string>();
    for (const r of list) {
      idSet.add(r.requesterID);
      idSet.add(r.targetMemberID);
    }
    const users = await User.find({
      userId: { $in: [...idSet] },
    })
      .select("userId username email name")
      .lean();
    const displayByUserId = new Map<string, string>();
    for (const u of users as {
      userId: unknown;
      username?: string;
      email?: string;
      name?: string;
    }[]) {
      const id = String(u.userId);
      const label =
        (u.username && String(u.username)) ||
        (u.name && String(u.name)) ||
        (u.email && String(u.email)) ||
        id;
      displayByUserId.set(id, label);
    }

    const enriched = list.map((r) => ({
      ...r,
      requesterDisplayName:
        displayByUserId.get(r.requesterID) ?? r.requesterID,
      targetDisplayName:
        displayByUserId.get(r.targetMemberID) ?? r.targetMemberID,
    }));

    return NextResponse.json({ paymentRequests: enriched });
  } catch (err) {
    console.error("GET payment-requests error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { userId?: string })?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const parsed = postBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { expenseID, targetMemberID, amount, message } = parsed.data;
    const requesterID = userId.toString();

    if (targetMemberID === requesterID) {
      return NextResponse.json(
        { error: "Cannot request payment from yourself" },
        { status: 400 },
      );
    }

    await dbConnect();

    const group = await TravelGroup.findOne({ groupID: groupId });
    if (!group) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    if (!isMember(group, requesterID)) {
      return NextResponse.json(
        { error: "Access denied. You do not have access to this group." },
        { status: 403 },
      );
    }

    const mids = memberIds(group);
    if (!mids.includes(targetMemberID)) {
      return NextResponse.json(
        { error: "Target is not a group member" },
        { status: 400 },
      );
    }

    const memberSet = new Set(mids);
    const ledgerRaw = group.ledger ?? [];
    const allExpenses = normalizeLedgerExpenses(
      ledgerRaw as Parameters<typeof normalizeLedgerExpenses>[0],
    );
    const active = filterExpensesByStatus(allExpenses, "active");
    const expense = active.find(
      (e) => e.expenseID != null && String(e.expenseID) === expenseID,
    );

    if (!expense) {
      return NextResponse.json(
        { error: "Expense not found or already settled" },
        { status: 400 },
      );
    }

    const payer = expense.payerID != null ? String(expense.payerID) : "";
    if (payer !== requesterID) {
      return NextResponse.json(
        { error: "You are not the payer for this expense" },
        { status: 400 },
      );
    }

    const maxCents = debtorShareOnExpenseCents(
      expense,
      requesterID,
      targetMemberID,
      memberSet,
    );
    if (maxCents <= 0) {
      return NextResponse.json(
        { error: "Target does not owe you for this expense" },
        { status: 400 },
      );
    }

    const amountCents = dollarsToCents(amount);
    if (amountCents > maxCents) {
      return NextResponse.json({ error: AMOUNT_EXCEEDS }, { status: 400 });
    }

    const existing = (group.paymentRequests ?? []) as Array<{
      status?: string;
      expenseID?: { toString(): string };
      requesterID?: { toString(): string };
      targetMemberID?: { toString(): string };
    }>;
    const dup = existing.some(
      (p) =>
        String(p.status) === "pending" &&
        String(p.expenseID) === expenseID &&
        String(p.requesterID) === requesterID &&
        String(p.targetMemberID) === targetMemberID,
    );
    if (dup) {
      return NextResponse.json(
        { error: "A pending payment request already exists for this expense" },
        { status: 409 },
      );
    }

    const requestID = randomUUID();
    const newRequest = {
      requestID,
      requesterID,
      targetMemberID,
      amount,
      expenseID,
      status: "pending" as const,
      createdAt: new Date(),
      ...(message != null && message.length > 0 ? { message } : {}),
    };

    if (!group.paymentRequests) {
      group.paymentRequests = [] as typeof group.paymentRequests;
    }
    group.paymentRequests.push(newRequest as never);
    await group.save();

    return NextResponse.json(
      {
        paymentRequest: {
          ...newRequest,
          requestID: String(requestID),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST payment-requests error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

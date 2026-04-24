import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import User from "@/models/User";
import {
  buildBreakdownPerMember,
  centsToDollars,
  computeNetBalancesCents,
  countExpenseStatuses,
  filterExpensesByStatus,
  minCashFlowSettlements,
  normalizeLedgerExpenses,
  type ExpenseFilter,
} from "@/lib/ledgerSummary";

function parseExpenseFilter(v: string | null): ExpenseFilter {
  if (v === "settled" || v === "all") return v;
  return "active";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.userId;

    if (!userId) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { groupId } = await params;
    if (!groupId) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const expenseFilter = parseExpenseFilter(url.searchParams.get("expenseFilter"));
    const includeBreakdown =
      url.searchParams.get("includeBreakdown") === "true" ||
      url.searchParams.get("includeBreakdown") === "1";

    await dbConnect();

    const groupDoc = await TravelGroup.findOne({ groupID: groupId }).lean();
    if (!groupDoc) {
      return NextResponse.json({ error: "group not found" }, { status: 404 });
    }

    const uid = userId.toString();
    const isMember = groupDoc.membersList.some(
      (m: { userId: { toString(): string } }) => m.userId.toString() === uid,
    );
    if (!isMember) {
      return NextResponse.json(
        { error: "Access denied. You do not have access to this group." },
        { status: 403 },
      );
    }

    const memberUserIds = groupDoc.membersList.map((m: { userId: unknown }) =>
      String(m.userId),
    );

    const ledgerRaw = (groupDoc as { ledger?: unknown[] }).ledger ?? [];
    const allExpenses = normalizeLedgerExpenses(ledgerRaw);
    const expenseCounts = countExpenseStatuses(allExpenses);

    const filtered = filterExpensesByStatus(allExpenses, expenseFilter);
    const balancesMap = computeNetBalancesCents(filtered, memberUserIds);
    const settlementsCents = minCashFlowSettlements(new Map(balancesMap));

    const users = await User.find({
      userId: { $in: memberUserIds },
    })
      .select("userId username email name")
      .lean();

    const displayByUserId = new Map<string, string>();
    for (const u of users as any[]) {
      const id = String(u.userId);
      const label =
        (u.username && String(u.username)) ||
        (u.name && String(u.name)) ||
        (u.email && String(u.email)) ||
        id;
      displayByUserId.set(id, label);
    }

    const balances = memberUserIds.map((id: string) => {
      const cents = balancesMap.get(id) ?? 0;
      return {
        userId: id,
        displayName: displayByUserId.get(id) ?? id,
        netCents: cents,
        netAmount: centsToDollars(cents),
      };
    });

    const settlements = settlementsCents.map((s) => ({
      fromUserId: s.fromUserId,
      toUserId: s.toUserId,
      fromDisplayName:
        displayByUserId.get(s.fromUserId) ?? s.fromUserId,
      toDisplayName: displayByUserId.get(s.toUserId) ?? s.toUserId,
      amountCents: s.amountCents,
      amount: centsToDollars(s.amountCents),
    }));

    const hasNoExpenses = expenseCounts.total === 0;
    const allExpensesSettled =
      expenseCounts.total > 0 &&
      expenseFilter === "active" &&
      expenseCounts.active === 0;

    let breakdown: Record<
      string,
      Array<{
        expenseID?: string;
        description?: string;
        amountCents: number;
        amount: number;
        kind: "credit" | "debit";
        counterpartyUserId?: string;
        counterpartyDisplayName?: string;
      }>
    > | null = null;

    if (includeBreakdown) {
      const raw = buildBreakdownPerMember(filtered, memberUserIds);
      breakdown = {};
      for (const id of memberUserIds) {
        breakdown[id] = (raw[id] ?? []).map((line) => ({
          ...line,
          amount: centsToDollars(line.amountCents),
          counterpartyDisplayName:
            line.counterpartyUserId != null
              ? (displayByUserId.get(line.counterpartyUserId) ??
                line.counterpartyUserId)
              : undefined,
        }));
      }
    }

    return NextResponse.json({
      expenseFilter,
      expenseCounts,
      meta: {
        hasNoExpenses,
        allExpensesSettled,
        memberCount: memberUserIds.length,
      },
      balances,
      settlements,
      ...(breakdown ? { breakdown } : {}),
    });
  } catch (err) {
    console.error("GET ledger/summary error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

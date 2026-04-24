import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import dbConnect from "@/lib/dbConnect";
import { authOptions } from "@/lib/auth";
import TravelGroup from "@/models/TravelGroup";
import {
  filterExpensesByStatus,
  normalizeLedgerExpenses,
} from "@/lib/ledgerSummary";
import { buildCreditorLinesForMember } from "@/lib/paymentRequestLedger";

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
    const debtorId = url.searchParams.get("debtorId") ?? undefined;

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

    if (debtorId != null && !memberUserIds.includes(String(debtorId))) {
      return NextResponse.json(
        { error: "debtor is not a group member" },
        { status: 400 },
      );
    }

    const ledgerRaw = (groupDoc as { ledger?: unknown[] }).ledger ?? [];
    const allExpenses = normalizeLedgerExpenses(ledgerRaw);
    const active = filterExpensesByStatus(allExpenses, "active");

    const lines = buildCreditorLinesForMember(
      active,
      uid,
      memberUserIds,
      debtorId,
    );

    return NextResponse.json({ lines });
  } catch (err) {
    console.error("GET ledger/creditor-lines error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

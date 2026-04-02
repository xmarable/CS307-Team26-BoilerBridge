import { dollarsToCents, centsToDollars } from "@/lib/ledgerSummary";

export type LedgerExpenseMutable = {
  expenseID?: unknown;
  payerID?: unknown;
  amount?: number;
  description?: string;
  debtors: Map<string, number> | Record<string, number> | undefined | null;
  isSettled?: boolean;
};

function getDebtorsRecord(
  debtors: LedgerExpenseMutable["debtors"],
): Record<string, number> {
  if (!debtors) return {};
  if (debtors instanceof Map) {
    const o: Record<string, number> = {};
    for (const [k, v] of debtors.entries()) {
      o[String(k)] = Number(v);
    }
    return o;
  }
  return { ...debtors };
}

function writeDebtorsBack(
  expense: LedgerExpenseMutable,
  next: Record<string, number>,
): void {
  if (expense.debtors instanceof Map) {
    expense.debtors.clear();
    for (const [k, v] of Object.entries(next)) {
      if (v > 0) expense.debtors.set(k, v);
    }
  } else {
    (expense as { debtors: Record<string, number> }).debtors = next;
  }
}

/**
 * Reduces debtor's share on the expense by the confirmed payment amount (cents-safe).
 * If no debtor still owes a positive amount, sets isSettled on the expense.
 */
export function applyConfirmedPaymentToExpense(
  expense: LedgerExpenseMutable,
  debtorId: string,
  amountDollars: number,
): void {
  const did = String(debtorId);
  const payCents = dollarsToCents(amountDollars);
  if (payCents <= 0) return;

  const rec = getDebtorsRecord(expense.debtors);
  const owedCents = dollarsToCents(rec[did] ?? 0);
  if (owedCents <= 0) return;

  const remainingCents = Math.max(0, owedCents - payCents);
  const next: Record<string, number> = { ...rec };

  if (remainingCents <= 0) {
    delete next[did];
  } else {
    next[did] = centsToDollars(remainingCents);
  }

  writeDebtorsBack(expense, next);

  const memberIds = Object.keys(next);
  const anyOwed = memberIds.some((id) => {
    const c = dollarsToCents(next[id] ?? 0);
    return c > 0;
  });
  if (!anyOwed) {
    expense.isSettled = true;
  }
}

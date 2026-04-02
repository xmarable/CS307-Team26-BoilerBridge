import {
  dollarsToCents,
  normalizeDebtorsForMembers,
  type LedgerExpenseInput,
} from "@/lib/ledgerSummary";

/**
 * Share (cents) that debtorId owes creditorId on this expense, if creditor is payer.
 */
export function debtorShareOnExpenseCents(
  expense: LedgerExpenseInput,
  creditorId: string,
  debtorId: string,
  memberSet: Set<string>,
): number {
  const payer = expense.payerID != null ? String(expense.payerID) : "";
  if (payer !== String(creditorId) || !memberSet.has(payer)) return 0;
  const debtors = normalizeDebtorsForMembers(expense.debtors, memberSet);
  const d = debtors[String(debtorId)];
  if (d == null || !Number.isFinite(Number(d)) || Number(d) <= 0) return 0;
  return dollarsToCents(Number(d));
}

/**
 * Net cents target owes requester across active expenses (pairwise).
 */
export function computeOwedByTargetToRequesterCents(
  targetId: string,
  requesterId: string,
  activeExpenses: LedgerExpenseInput[],
  memberUserIds: string[],
): number {
  const memberSet = new Set(memberUserIds.map(String));
  let cents = 0;
  for (const exp of activeExpenses) {
    cents += debtorShareOnExpenseCents(exp, requesterId, targetId, memberSet);
    cents -= debtorShareOnExpenseCents(exp, targetId, requesterId, memberSet);
  }
  return cents;
}

export type CreditorLine = {
  expenseID: string;
  description?: string;
  amountOwed: number;
  amountOwedCents: number;
};

/** Active expenses where creditorId is payer and debtorId owes them (optional debtor filter). */
export function buildCreditorLinesForMember(
  activeExpenses: LedgerExpenseInput[],
  creditorId: string,
  memberUserIds: string[],
  debtorIdFilter?: string,
): CreditorLine[] {
  const memberSet = new Set(memberUserIds.map(String));
  const creditor = String(creditorId);
  const out: CreditorLine[] = [];

  for (const exp of activeExpenses) {
    const payer = exp.payerID != null ? String(exp.payerID) : "";
    if (payer !== creditor || !memberSet.has(payer)) continue;
    const debtors = normalizeDebtorsForMembers(exp.debtors, memberSet);
    for (const [debtorId, amtDollars] of Object.entries(debtors)) {
      if (debtorIdFilter != null && String(debtorId) !== String(debtorIdFilter))
        continue;
      const v = Number(amtDollars);
      if (!Number.isFinite(v) || v <= 0) continue;
      const expenseID = exp.expenseID != null ? String(exp.expenseID) : "";
      if (!expenseID) continue;
      const amountOwedCents = dollarsToCents(v);
      out.push({
        expenseID,
        description: exp.description,
        amountOwed: Math.round(v * 100) / 100,
        amountOwedCents,
      });
    }
  }

  return out;
}

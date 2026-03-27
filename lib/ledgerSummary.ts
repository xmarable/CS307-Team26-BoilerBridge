/**
 * Ledger summary: net balances and min-cash-flow settlements.
 *
 * Semantics: For each expense, `debtors` maps debtor userId (UUID string, same as
 * TravelGroup.membersList[].userId) → dollar amount that debtor owes the payer.
 * Payer net += sum(debtors); each debtor net -= their amount.
 */

export type ExpenseFilter = "active" | "settled" | "all";

export type LedgerExpenseInput = {
  expenseID?: string;
  payerID: string;
  amount: number;
  description?: string;
  debtors: Map<string, number> | Record<string, number> | undefined | null;
  isSettled: boolean;
};

export type BreakdownLine = {
  expenseID?: string;
  description?: string;
  amountCents: number;
  /** Payer receiving shares from others */
  kind: "credit" | "debit";
  /** For debit: who was paid; for credit: not used */
  counterpartyUserId?: string;
};

export function dollarsToCents(d: number): number {
  return Math.round(Number(d) * 100);
}

export function centsToDollars(cents: number): number {
  return Math.round(cents) / 100;
}

function debtorsEntries(
  debtors: LedgerExpenseInput["debtors"],
): [string, number][] {
  if (!debtors) return [];
  if (debtors instanceof Map) {
    return [...debtors.entries()].map(([k, v]) => [String(k), Number(v)]);
  }
  return Object.entries(debtors).map(([k, v]) => [String(k), Number(v)]);
}

/** Only debtors who are current group members count. */
export function normalizeDebtorsForMembers(
  debtors: LedgerExpenseInput["debtors"],
  memberSet: Set<string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, raw] of debtorsEntries(debtors)) {
    if (!memberSet.has(k)) continue;
    const v = Number(raw);
    if (!Number.isFinite(v) || v === 0) continue;
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function filterExpensesByStatus(
  expenses: LedgerExpenseInput[],
  filter: ExpenseFilter,
): LedgerExpenseInput[] {
  return expenses.filter((e) => {
    if (filter === "active") return !e.isSettled;
    if (filter === "settled") return e.isSettled;
    return true;
  });
}

export function countExpenseStatuses(ledger: { isSettled: boolean }[]): {
  total: number;
  settled: number;
  active: number;
} {
  const total = ledger.length;
  const settled = ledger.filter((e) => e.isSettled).length;
  return { total, settled, active: total - settled };
}

/**
 * Net balance in cents: positive = member is owed money overall; negative = they owe.
 */
export function computeNetBalancesCents(
  expenses: LedgerExpenseInput[],
  memberUserIds: string[],
): Map<string, number> {
  const memberSet = new Set(memberUserIds.map(String));
  const balances = new Map<string, number>();
  for (const id of memberUserIds) balances.set(String(id), 0);

  for (const exp of expenses) {
    const payer = exp.payerID != null ? String(exp.payerID) : "";
    if (!payer || !memberSet.has(payer)) continue;

    const debtors = normalizeDebtorsForMembers(exp.debtors, memberSet);
    let owedToPayerCents = 0;
    for (const [debtorId, amtDollars] of Object.entries(debtors)) {
      const cents = dollarsToCents(amtDollars);
      owedToPayerCents += cents;
      balances.set(debtorId, (balances.get(debtorId) ?? 0) - cents);
    }
    balances.set(payer, (balances.get(payer) ?? 0) + owedToPayerCents);
  }

  return balances;
}

export type SettlementCents = {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
};

/**
 * Greedy min-cash-flow: match largest debtor to largest creditor until balanced.
 */
export function minCashFlowSettlements(
  balances: Map<string, number>,
): SettlementCents[] {
  const creditors: { id: string; bal: number }[] = [];
  const debtors: { id: string; bal: number }[] = [];

  for (const [id, cents] of balances.entries()) {
    if (Math.abs(cents) < 1) continue;
    if (cents > 0) creditors.push({ id, bal: cents });
    else debtors.push({ id, bal: -cents });
  }

  creditors.sort((a, b) => b.bal - a.bal);
  debtors.sort((a, b) => b.bal - a.bal);

  const settlements: SettlementCents[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]!;
    const c = creditors[j]!;
    const pay = Math.min(d.bal, c.bal);
    if (pay > 0) {
      settlements.push({
        fromUserId: d.id,
        toUserId: c.id,
        amountCents: pay,
      });
    }
    d.bal -= pay;
    c.bal -= pay;
    if (d.bal <= 0) i++;
    if (c.bal <= 0) j++;
  }

  return settlements;
}

export function buildBreakdownPerMember(
  expenses: LedgerExpenseInput[],
  memberUserIds: string[],
): Record<string, BreakdownLine[]> {
  const memberSet = new Set(memberUserIds.map(String));
  const out: Record<string, BreakdownLine[]> = {};
  for (const id of memberUserIds) out[String(id)] = [];

  for (const exp of expenses) {
    const payer = exp.payerID != null ? String(exp.payerID) : "";
    if (!payer || !memberSet.has(payer)) continue;

    const debtors = normalizeDebtorsForMembers(exp.debtors, memberSet);
    const totalOwedCents = Object.values(debtors).reduce(
      (s, d) => s + dollarsToCents(d),
      0,
    );
    if (totalOwedCents > 0) {
      out[payer]!.push({
        expenseID: exp.expenseID,
        description: exp.description,
        amountCents: totalOwedCents,
        kind: "credit",
      });
    }
    for (const [debtorId, amtDollars] of Object.entries(debtors)) {
      out[debtorId]!.push({
        expenseID: exp.expenseID,
        description: exp.description,
        amountCents: dollarsToCents(amtDollars),
        kind: "debit",
        counterpartyUserId: payer,
      });
    }
  }

  return out;
}

/** Normalize raw ledger subdocs from Mongo lean() into LedgerExpenseInput[]. */
export function normalizeLedgerExpenses(raw: unknown[]): LedgerExpenseInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: any) => ({
    expenseID: e.expenseID != null ? String(e.expenseID) : undefined,
    payerID: e.payerID != null ? String(e.payerID) : "",
    amount: Number(e.amount) || 0,
    description: e.description != null ? String(e.description) : undefined,
    debtors: e.debtors,
    isSettled: Boolean(e.isSettled),
  }));
}

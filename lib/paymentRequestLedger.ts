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

const roundMoney = (n: number) => Math.round(n * 100) / 100;

function getDebtorAmount(
  debtors: Map<string, number> | Record<string, number>,
  memberId: string,
): number {
  const id = String(memberId);
  if (debtors instanceof Map) {
    if (debtors.has(id)) return Number(debtors.get(id));
    for (const [k, v] of debtors.entries()) {
      if (String(k) === id) return Number(v);
    }
    return 0;
  }
  const o = debtors as Record<string, number>;
  if (Object.prototype.hasOwnProperty.call(o, id)) return Number(o[id]);
  for (const k of Object.keys(o)) {
    if (String(k) === id) return Number(o[k]);
  }
  return 0;
}

function setDebtorAmount(
  debtors: Map<string, number> | Record<string, number>,
  memberId: string,
  amount: number,
): void {
  const id = String(memberId);
  const v = roundMoney(amount);
  if (debtors instanceof Map) {
    let key = id;
    if (!debtors.has(id)) {
      for (const k of debtors.keys()) {
        if (String(k) === id) {
          key = k;
          break;
        }
      }
    }
    if (v <= 0.001) debtors.delete(key);
    else debtors.set(key, v);
    return;
  }
  const o = debtors as Record<string, number>;
  let key = id;
  if (!(id in o)) {
    for (const k of Object.keys(o)) {
      if (String(k) === id) {
        key = k;
        break;
      }
    }
  }
  if (v <= 0.001) delete o[key];
  else o[key] = v;
}

function totalDebtorsOwed(
  debtors: Map<string, number> | Record<string, number>,
): number {
  let sum = 0;
  if (debtors instanceof Map) {
    for (const v of debtors.values()) sum += Number(v);
  } else {
    for (const v of Object.values(debtors as Record<string, number>)) {
      sum += Number(v);
    }
  }
  return roundMoney(sum);
}

/**
 * When a payment request is marked paid, reduce the debtor's balance on the
 * matching ledger expense and mark the expense settled if nothing is left owed.
 * Mutates the Mongoose group document; caller should save after markModified.
 */
export function applyPaymentRequestToLedger(
  group: { ledger?: unknown[]; markModified?: (path: string) => void },
  pr: {
    expenseID: unknown;
    amount: unknown;
    targetMemberID: unknown;
  },
): void {
  const eid = String(pr.expenseID);
  const target = String(pr.targetMemberID);
  const paid = Number(pr.amount);
  if (!Number.isFinite(paid) || paid < 0) return;

  const ledger = group.ledger;
  if (!Array.isArray(ledger)) return;

  const exp = ledger.find(
    (x) =>
      x != null &&
      String((x as { expenseID?: unknown }).expenseID) === eid,
  ) as
    | {
        debtors?: Map<string, number> | Record<string, number>;
        isSettled?: boolean;
      }
    | undefined;

  if (!exp?.debtors) return;

  const cur = getDebtorAmount(exp.debtors, target);
  const next = Math.max(0, roundMoney(cur - paid));
  setDebtorAmount(exp.debtors, target, next);

  if (totalDebtorsOwed(exp.debtors) < 0.01) {
    exp.isSettled = true;
  }

  group.markModified?.("ledger");
}

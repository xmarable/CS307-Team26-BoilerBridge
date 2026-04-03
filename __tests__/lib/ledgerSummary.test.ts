import {
  buildBreakdownPerMember,
  centsToDollars,
  computeNetBalancesCents,
  countExpenseStatuses,
  dollarsToCents,
  filterExpensesByStatus,
  minCashFlowSettlements,
  normalizeDebtorsForMembers,
  type LedgerExpenseInput,
} from "@/lib/ledgerSummary";

describe("ledgerSummary", () => {
  const id = (s: string) => s;

  it("dollarsToCents and centsToDollars round consistently", () => {
    expect(dollarsToCents(10.005)).toBe(1001);
    expect(centsToDollars(1001)).toBe(10.01);
  });

  it("normalizes debtors to members only", () => {
    const members = new Set([id("a"), id("b")]);
    const debtors = { a: 10, stranger: 99, b: 5 };
    expect(normalizeDebtorsForMembers(debtors, members)).toEqual({
      a: 10,
      b: 5,
    });
  });

  it("computes net balances for overlapping expenses", () => {
    const a = id("user-a");
    const b = id("user-b");
    const c = id("user-c");
    const members = [a, b, c];
    const expenses: LedgerExpenseInput[] = [
      {
        payerID: a,
        amount: 90,
        description: "hotel",
        isSettled: false,
        debtors: new Map([
          [b, 30],
          [c, 30],
        ]),
      },
      {
        payerID: b,
        amount: 30,
        description: "taxi",
        isSettled: false,
        debtors: new Map([[c, 15]]),
      },
    ];
    const bal = computeNetBalancesCents(expenses, members);
    expect(bal.get(a)).toBe(dollarsToCents(60));
    expect(bal.get(b)).toBe(dollarsToCents(30 - 30 - 15));
    expect(bal.get(c)).toBe(dollarsToCents(-30 - 15));
  });

  it("excludes settled expenses when filter is active", () => {
    const a = id("p");
    const b = id("q");
    const all: LedgerExpenseInput[] = [
      {
        payerID: a,
        amount: 20,
        isSettled: true,
        debtors: { [b]: 20 },
      },
      {
        payerID: a,
        amount: 10,
        isSettled: false,
        debtors: { [b]: 10 },
      },
    ];
    const active = filterExpensesByStatus(all, "active");
    expect(active).toHaveLength(1);
    const bal = computeNetBalancesCents(active, [a, b]);
    expect(bal.get(a)).toBe(dollarsToCents(10));
    expect(bal.get(b)).toBe(dollarsToCents(-10));
  });

  it("minCashFlowSettlements uses at most n-1 payments for n people", () => {
    const a = id("a");
    const b = id("b");
    const c = id("c");
    const d = id("d");
    const expenses: LedgerExpenseInput[] = [
      {
        payerID: a,
        amount: 100,
        isSettled: false,
        debtors: new Map([
          [b, 25],
          [c, 25],
          [d, 25],
        ]),
      },
    ];
    const bal = computeNetBalancesCents(expenses, [a, b, c, d]);
    const settlements = minCashFlowSettlements(bal);
    const involved = new Set<string>();
    for (const s of settlements) {
      involved.add(s.fromUserId);
      involved.add(s.toUserId);
    }
    const n = [...bal.values()].filter((v) => Math.abs(v) > 0).length;
    expect(settlements.length).toBeLessThanOrEqual(Math.max(0, n - 1) || 0);
    expect(settlements.length).toBe(3);
    let sumPaid = 0;
    for (const s of settlements) sumPaid += s.amountCents;
    expect(sumPaid).toBe(dollarsToCents(75));
  });

  it("countExpenseStatuses counts active and settled", () => {
    expect(
      countExpenseStatuses([
        { isSettled: false },
        { isSettled: true },
        { isSettled: true },
      ]),
    ).toEqual({ total: 3, settled: 2, active: 1 });
  });

  it("buildBreakdownPerMember lists credit and debit lines", () => {
    const a = id("pa");
    const b = id("db");
    const expenses: LedgerExpenseInput[] = [
      {
        payerID: a,
        amount: 40,
        description: "lunch",
        isSettled: false,
        debtors: { [b]: 40 },
      },
    ];
    const bd = buildBreakdownPerMember(expenses, [a, b]);
    expect(bd[a]!.some((l) => l.kind === "credit" && l.amountCents === 4000)).toBe(
      true,
    );
    expect(
      bd[b]!.some(
        (l) =>
          l.kind === "debit" &&
          l.counterpartyUserId === a &&
          l.amountCents === 4000,
      ),
    ).toBe(true);
  });
});

import { applyPaymentRequestToLedger } from "@/lib/paymentRequestLedger";

describe("applyPaymentRequestToLedger", () => {
  it("reduces debtor share and marks expense settled when fully paid", () => {
    const expenseID = "550e8400-e29b-41d4-a716-446655440000";
    const payer = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    const debtor = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

    const ledger = [
      {
        expenseID,
        payerID: payer,
        amount: 20,
        description: "Uber",
        debtors: new Map<string, number>([
          [debtor, 10],
        ]),
        isSettled: false,
      },
    ];

    const marks: string[] = [];
    const group = {
      ledger,
      markModified: (p: string) => {
        marks.push(p);
      },
    };

    applyPaymentRequestToLedger(group, {
      expenseID,
      amount: 10,
      targetMemberID: debtor,
    });

    expect(ledger[0].isSettled).toBe(true);
    expect((ledger[0].debtors as Map<string, number>).size).toBe(0);
    expect(marks).toContain("ledger");
  });

  it("partial payment leaves expense active", () => {
    const expenseID = "660e8400-e29b-41d4-a716-446655440001";
    const payer = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
    const debtor = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

    const ledger = [
      {
        expenseID,
        payerID: payer,
        amount: 30,
        debtors: new Map<string, number>([[debtor, 30]]),
        isSettled: false,
      },
    ];

    applyPaymentRequestToLedger(
      { ledger, markModified: () => {} },
      { expenseID, amount: 10, targetMemberID: debtor },
    );

    expect(ledger[0].isSettled).toBe(false);
    expect((ledger[0].debtors as Map<string, number>).get(debtor)).toBe(20);
  });
});

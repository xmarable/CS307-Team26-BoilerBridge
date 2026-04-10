"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import RequestPaymentModal from "@/components/group/RequestPaymentModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type BalanceRow = {
  userId: string;
  displayName: string;
  netCents: number;
  netAmount: number;
};

type SettlementRow = {
  fromUserId: string;
  toUserId: string;
  fromDisplayName: string;
  toDisplayName: string;
  amountCents: number;
  amount: number;
};

type BreakdownLine = {
  expenseID?: string;
  description?: string;
  amountCents: number;
  amount: number;
  kind: "credit" | "debit";
  counterpartyUserId?: string;
  counterpartyDisplayName?: string;
};

type SummaryResponse = {
  expenseFilter: string;
  expenseCounts: { total: number; settled: number; active: number };
  meta: {
    hasNoExpenses: boolean;
    allExpensesSettled: boolean;
    memberCount: number;
  };
  balances: BalanceRow[];
  settlements: SettlementRow[];
  breakdown?: Record<string, BreakdownLine[]>;
};

function formatMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

type Props = {
  groupId: string;
  currentUserId?: string | null;
  onPaymentRequestCreated?: () => void;
};

export default function ExpenseSummaryPanel({
  groupId,
  currentUserId,
  onPaymentRequestCreated,
}: Props) {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [expenseFilter, setExpenseFilter] = useState<
    "active" | "settled" | "all"
  >("active");
  const [includeBreakdown, setIncludeBreakdown] = useState(false);
  const [settlementSort, setSettlementSort] = useState<
    "amount-desc" | "amount-asc"
  >("amount-desc");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [prModal, setPrModal] = useState<{
    debtorUserId: string;
    debtorDisplayName: string;
    amount: number;
  } | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("expenseFilter", expenseFilter);
    if (includeBreakdown) p.set("includeBreakdown", "true");
    return p.toString();
  }, [expenseFilter, includeBreakdown]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/ledger/summary?${qs}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || `Request failed (${res.status})`);
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setErr("Failed to load expense summary.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [groupId, qs]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const sortedSettlements = useMemo(() => {
    if (!data?.settlements) return [];
    const copy = [...data.settlements];
    copy.sort((a, b) =>
      settlementSort === "amount-desc"
        ? b.amountCents - a.amountCents
        : a.amountCents - b.amountCents,
    );
    return copy;
  }, [data?.settlements, settlementSort]);

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-amber-600">
        <Loader2 className="animate-spin mr-2" size={28} />
        <span className="font-bold">Loading summary…</span>
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700 font-medium">
        {err}
      </div>
    );
  }

  if (!data) return null;

  const { meta, expenseCounts } = data;

  const uid = currentUserId ?? "";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-4">
        <div className="space-y-2">
          <Label className="text-gray-600 font-bold text-xs uppercase tracking-wider">
            Expenses in summary
          </Label>
          <Select
            value={expenseFilter}
            onValueChange={(v) =>
              setExpenseFilter(v as "active" | "settled" | "all")
            }
          >
            <SelectTrigger className="w-55 rounded-xl border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Unsettled only</SelectItem>
              <SelectItem value="settled">Settled only</SelectItem>
              <SelectItem value="all">All expenses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-gray-600 font-bold text-xs uppercase tracking-wider">
            Sort settlements
          </Label>
          <Select
            value={settlementSort}
            onValueChange={(v) =>
              setSettlementSort(v as "amount-desc" | "amount-asc")
            }
          >
            <SelectTrigger className="w-50 rounded-xl border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amount-desc">Amount (high → low)</SelectItem>
              <SelectItem value="amount-asc">Amount (low → high)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 pb-1">
          <Switch
            id="breakdown-toggle"
            checked={includeBreakdown}
            onCheckedChange={setIncludeBreakdown}
          />
          <Label
            htmlFor="breakdown-toggle"
            className="font-bold text-gray-700 cursor-pointer"
          >
            Show expense breakdown
          </Label>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        {expenseCounts.total === 0
          ? "No expenses recorded."
          : `${expenseCounts.active} unsettled · ${expenseCounts.settled} settled · ${expenseCounts.total} total`}
      </p>

      {meta.hasNoExpenses && (
        <div className="rounded-4xl border border-amber-100 bg-amber-50/80 p-8 text-center">
          <p className="text-lg font-black text-amber-900">
            There are no expenses to summarize yet.
          </p>
          <p className="text-amber-800/80 mt-2 font-medium">
            Add trip expenses to the group ledger to see balances here.
          </p>
        </div>
      )}

      {!meta.hasNoExpenses && meta.allExpensesSettled && (
        <div className="rounded-4xl border border-green-100 bg-green-50/90 p-8 text-center">
          <p className="text-lg font-black text-green-900">All settled up!</p>
          <p className="text-green-800/80 mt-2 font-medium">
            Every expense in this group is marked settled. Switch to &quot;All
            expenses&quot; or &quot;Settled only&quot; to review history.
          </p>
        </div>
      )}

      {!meta.hasNoExpenses && meta.memberCount <= 1 && (
        <p className="text-sm text-gray-500 italic">
          Solo group: no split settlements between members.
        </p>
      )}

      {meta.hasNoExpenses ? null : (
        <>
          <section className="space-y-3">
            <h3 className="text-xl font-black text-gray-900 tracking-tight px-1">
              Net balance
            </h3>
            <p className="text-xs text-gray-500 px-1 -mt-1">
              Positive = you are owed money · Negative = you owe others
            </p>
            <div className="bg-white rounded-4xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 font-bold text-gray-600">
                      Member
                    </th>
                    <th className="px-6 py-3 font-bold text-gray-600 text-right">
                      Net
                    </th>
                    {includeBreakdown && data.breakdown && (
                      <th className="px-6 py-3 font-bold text-gray-600 w-12" />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.balances.map((row) => {
                    const lines = data.breakdown?.[row.userId] ?? [];
                    const open = expandedUsers.has(row.userId);
                    return (
                      <Fragment key={row.userId}>
                        <tr className="border-b border-gray-50 last:border-0">
                          <td className="px-6 py-4 font-bold text-gray-900">
                            {row.displayName}
                          </td>
                          <td
                            className={`px-6 py-4 text-right font-black ${
                              row.netCents > 0
                                ? "text-green-700"
                                : row.netCents < 0
                                  ? "text-red-600"
                                  : "text-gray-500"
                            }`}
                          >
                            {formatMoney(row.netAmount)}
                          </td>
                          {includeBreakdown && data.breakdown && (
                            <td className="px-2 py-2">
                              {lines.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleUser(row.userId)}
                                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                                  aria-expanded={open}
                                >
                                  {open ? (
                                    <ChevronDown size={18} />
                                  ) : (
                                    <ChevronRight size={18} />
                                  )}
                                </button>
                              ) : null}
                            </td>
                          )}
                        </tr>
                        {includeBreakdown &&
                          open &&
                          lines.map((line, idx) => (
                            <tr
                              key={`${row.userId}-${line.expenseID ?? idx}-${line.kind}-${idx}`}
                              className="bg-gray-50/80 text-xs"
                            >
                              <td
                                className="px-6 py-2 pl-12 text-gray-600"
                                colSpan={
                                  includeBreakdown && data.breakdown ? 3 : 2
                                }
                              >
                                <span className="font-semibold">
                                  {line.kind === "credit"
                                    ? "Owed to you"
                                    : `You owe ${line.counterpartyDisplayName ?? "member"}`}
                                </span>
                                {line.description
                                  ? ` · ${line.description}`
                                  : ""}
                                <span className="ml-2 tabular-nums font-bold text-gray-800">
                                  {formatMoney(line.amount)}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-xl font-black text-gray-900 tracking-tight px-1">
              Suggested settlements
            </h3>
            <p className="text-xs text-gray-500 px-1 -mt-1">
              Fewest payments to settle up (min cash flow)
            </p>
            {sortedSettlements.length === 0 ? (
              <div className="rounded-4xl border border-gray-100 bg-gray-50 p-6 text-gray-600 font-medium">
                No payments needed — everyone is even for this filter.
              </div>
            ) : (
              <ul className="space-y-3">
                {sortedSettlements.map((s, i) => (
                  <li
                    key={`${s.fromUserId}-${s.toUserId}-${i}`}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <span className="font-bold text-gray-900">
                      <span className="text-amber-700">
                        {s.fromDisplayName}
                      </span>
                      <span className="text-gray-400 font-medium mx-2">
                        pays
                      </span>
                      <span className="text-gray-900">{s.toDisplayName}</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-black text-lg text-gray-900 tabular-nums">
                        {formatMoney(s.amount)}
                      </span>
                      {uid && s.toUserId === uid ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-amber-200 text-amber-800 hover:bg-amber-50"
                          onClick={() =>
                            setPrModal({
                              debtorUserId: s.fromUserId,
                              debtorDisplayName: s.fromDisplayName,
                              amount: s.amount,
                            })
                          }
                        >
                          Request payment
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {prModal ? (
        <RequestPaymentModal
          groupId={groupId}
          open={!!prModal}
          onOpenChange={(open) => {
            if (!open) setPrModal(null);
          }}
          debtorUserId={prModal.debtorUserId}
          debtorDisplayName={prModal.debtorDisplayName}
          suggestedAmount={prModal.amount}
          onSuccess={() => {
            setPrModal(null);
            onPaymentRequestCreated?.();
          }}
        />
      ) : null}
    </div>
  );
}

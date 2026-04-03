"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type PaymentRequestRow = {
  requestID: string;
  requesterID: string;
  targetMemberID: string;
  amount: number;
  expenseID: string;
  status: "pending" | "paid" | "declined";
  createdAt?: string;
  message?: string;
  declineReason?: string;
  confirmedAt?: string;
  requesterDisplayName?: string;
  targetDisplayName?: string;
};

function formatMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function statusBadge(status: PaymentRequestRow["status"]) {
  if (status === "pending")
    return (
      <Badge className="rounded-lg bg-amber-100 text-amber-900 hover:bg-amber-100">
        Pending
      </Badge>
    );
  if (status === "paid")
    return (
      <Badge className="rounded-lg bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
        Paid
      </Badge>
    );
  return (
    <Badge className="rounded-lg bg-gray-200 text-gray-800 hover:bg-gray-200">
      Declined
    </Badge>
  );
}

type Props = {
  groupId: string;
  currentUserId: string;
  refreshKey?: number;
};

export default function PaymentRequestsPanel({
  groupId,
  currentUserId,
  refreshKey = 0,
}: Props) {
  const [rows, setRows] = useState<PaymentRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<PaymentRequestRow | null>(
    null,
  );
  const [declineReason, setDeclineReason] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<PaymentRequestRow | null>(
    null,
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/payment-requests`,
        { credentials: "include" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j.error || `Failed to load (${res.status})`);
        setRows([]);
        return;
      }
      setRows(j.paymentRequests ?? []);
    } catch {
      setErr("Failed to load payment requests.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refreshKey]);

  const incoming = rows.filter((r) => r.targetMemberID === currentUserId);
  const outgoing = rows.filter((r) => r.requesterID === currentUserId);

  const confirmPayment = async () => {
    if (!confirmTarget) return;
    setActionId(confirmTarget.requestID);
    setErr(null);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/payment-requests/${confirmTarget.requestID}/confirm`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          typeof j.error === "string" ? j.error : `Update failed (${res.status})`,
        );
        toast.error(
          typeof j.error === "string" ? j.error : "Could not confirm payment.",
        );
        return;
      }
      setConfirmTarget(null);
      toast.success("Payment confirmed.");
      await fetchRequests();
    } catch {
      setErr("Network error.");
      toast.error("Network error.");
    } finally {
      setActionId(null);
    }
  };

  const declineRequest = async (
    r: PaymentRequestRow,
    reason?: string,
  ) => {
    setActionId(r.requestID);
    try {
      const res = await fetch(
        `/api/groups/${groupId}/payment-requests/${r.requestID}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            status: "declined",
            ...(reason?.trim() ? { reason: reason.trim() } : {}),
          }),
        },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error || `Update failed (${res.status})`);
        return;
      }
      await fetchRequests();
      setDeclineOpen(false);
      setDeclineTarget(null);
      setDeclineReason("");
    } catch {
      setErr("Network error.");
    } finally {
      setActionId(null);
    }
  };

  const openDecline = (r: PaymentRequestRow) => {
    setDeclineTarget(r);
    setDeclineReason("");
    setDeclineOpen(true);
  };

  const submitDecline = async () => {
    if (!declineTarget) return;
    setDeclineSubmitting(true);
    try {
      await declineRequest(
        declineTarget,
        declineReason.trim() || undefined,
      );
    } finally {
      setDeclineSubmitting(false);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-amber-700">
        <Loader2 className="animate-spin mr-2" size={24} />
        <span className="font-bold">Loading payment requests…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-10 pt-10 border-t border-gray-100">
      <div className="flex items-center gap-3">
        <h3 className="text-xl font-black text-gray-900 tracking-tight">
          My payment requests
        </h3>
      </div>

      {err && (
        <p className="text-sm text-red-600 font-medium rounded-xl bg-red-50 px-4 py-2">
          {err}
        </p>
      )}

      <section className="space-y-3">
        <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
          Incoming
        </h4>
        {incoming.length === 0 ? (
          <p className="text-sm text-gray-500">No incoming requests.</p>
        ) : (
          <ul className="space-y-3">
            {incoming.map((r) => (
              <li
                key={r.requestID}
                className="rounded-2xl border border-gray-100 bg-gray-50/80 px-5 py-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-gray-900">
                    From{" "}
                    <span className="text-amber-800">
                      {r.requesterDisplayName ?? r.requesterID}
                    </span>
                  </p>
                  <p className="text-lg font-black tabular-nums text-gray-900 mt-1">
                    {formatMoney(r.amount)}
                  </p>
                  {r.message ? (
                    <p className="text-xs text-gray-600 mt-1 italic">
                      &ldquo;{r.message}&rdquo;
                    </p>
                  ) : null}
                  {r.status === "declined" && r.declineReason ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Reason: {r.declineReason}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge(r.status)}
                  {r.status === "pending" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                        disabled={actionId === r.requestID}
                        onClick={() => setConfirmTarget(r)}
                      >
                        Confirm payment
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        disabled={actionId === r.requestID}
                        onClick={() => openDecline(r)}
                      >
                        Decline
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
          Outgoing
        </h4>
        {outgoing.length === 0 ? (
          <p className="text-sm text-gray-500">No outgoing requests.</p>
        ) : (
          <ul className="space-y-3">
            {outgoing.map((r) => (
              <li
                key={r.requestID}
                className="rounded-2xl border border-gray-100 bg-white px-5 py-4 flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <p className="font-bold text-gray-900">
                    To{" "}
                    <span className="text-gray-800">
                      {r.targetDisplayName ?? r.targetMemberID}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {formatMoney(r.amount)}
                  </p>
                  {r.message ? (
                    <p className="text-xs text-gray-600 mt-1 italic">
                      &ldquo;{r.message}&rdquo;
                    </p>
                  ) : null}
                  {r.status === "declined" && r.declineReason ? (
                    <p className="text-xs text-amber-800 mt-1">
                      They declined: {r.declineReason}
                    </p>
                  ) : null}
                </div>
                {statusBadge(r.status)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm payment</AlertDialogTitle>
            <AlertDialogDescription>
              Confirm you have paid {formatMoney(confirmTarget?.amount ?? 0)} to{" "}
              <span className="font-semibold text-foreground">
                {confirmTarget?.requesterDisplayName ?? "the requester"}
              </span>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl" type="button">
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
              disabled={!!confirmTarget && actionId === confirmTarget.requestID}
              onClick={() => void confirmPayment()}
            >
              {confirmTarget && actionId === confirmTarget.requestID ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                "Confirm"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Decline request</DialogTitle>
            <DialogDescription>
              Optionally add a short note for{" "}
              {declineTarget?.requesterDisplayName ?? "the requester"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Reason (optional)</Label>
            <Textarea
              id="decline-reason"
              className="rounded-xl min-h-[88px]"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Already paid cash"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setDeclineOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={declineSubmitting}
              onClick={submitDecline}
            >
              {declineSubmitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Decline request"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

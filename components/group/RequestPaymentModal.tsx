"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

type CreditorLine = {
  expenseID: string;
  description?: string;
  amountOwed: number;
  amountOwedCents: number;
};

const baseSchema = z.object({
  expenseID: z.string().uuid("Choose an expense"),
  amount: z.number().positive("Enter a positive amount"),
  message: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof baseSchema>;

type Props = {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debtorUserId: string;
  debtorDisplayName: string;
  suggestedAmount: number;
  onSuccess?: () => void;
};

export default function RequestPaymentModal({
  groupId,
  open,
  onOpenChange,
  debtorUserId,
  debtorDisplayName,
  suggestedAmount,
  onSuccess,
}: Props) {
  const [lines, setLines] = useState<CreditorLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      expenseID: "",
      amount: suggestedAmount,
      message: "",
    },
  });

  const { register, handleSubmit, reset, setValue, watch, setError, formState } =
    form;
  const expenseIdWatch = watch("expenseID");

  useEffect(() => {
    if (!open) return;
    setFetchError(null);
    setSubmitError(null);
    setLoadingLines(true);
    fetch(
      `/api/groups/${groupId}/ledger/creditor-lines?debtorId=${encodeURIComponent(debtorUserId)}`,
      { credentials: "include" },
    )
      .then(async (res) => {
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLines([]);
          setFetchError(j.error || `Failed to load expenses (${res.status})`);
          return;
        }
        const raw = (j.lines ?? []) as CreditorLine[];
        setLines(raw);
        if (raw.length > 0) {
          const best = [...raw].sort(
            (a, b) => b.amountOwedCents - a.amountOwedCents,
          )[0]!;
          setValue("expenseID", best.expenseID);
          const cap = best.amountOwed;
          setValue(
            "amount",
            Math.min(suggestedAmount, cap) > 0
              ? Math.round(Math.min(suggestedAmount, cap) * 100) / 100
              : cap,
          );
        } else {
          setValue("expenseID", "");
        }
      })
      .catch(() => {
        setLines([]);
        setFetchError("Failed to load expenses.");
      })
      .finally(() => setLoadingLines(false));
  }, [open, groupId, debtorUserId, setValue, suggestedAmount]);

  useEffect(() => {
    if (!open) {
      reset({ expenseID: "", amount: suggestedAmount, message: "" });
      setLines([]);
      setFetchError(null);
      setSubmitError(null);
    }
  }, [open, reset, suggestedAmount]);

  const selectedLine = useMemo(
    () => lines.find((l) => l.expenseID === expenseIdWatch),
    [lines, expenseIdWatch],
  );

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    const line = lines.find((l) => l.expenseID === values.expenseID);
    if (!line) {
      setError("expenseID", { message: "Choose an expense" });
      return;
    }
    const max = line.amountOwed;
    if (values.amount > max + 0.005) {
      setError("amount", {
        message: "Amount exceeds outstanding balance",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/groups/${groupId}/payment-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          expenseID: values.expenseID,
          targetMemberID: debtorUserId,
          amount: values.amount,
          message:
            values.message && values.message.trim().length > 0
              ? values.message.trim()
              : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (
          res.status === 400 &&
          typeof j.error === "string" &&
          j.error.includes("exceeds")
        ) {
          setError("amount", { message: j.error });
        } else {
          setSubmitError(j.error || `Request failed (${res.status})`);
        }
        return;
      }
      onOpenChange(false);
      onSuccess?.();
    } catch {
      setSubmitError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request payment</DialogTitle>
          <DialogDescription>
            Ask{" "}
            <span className="font-semibold text-foreground">
              {debtorDisplayName}
            </span>{" "}
            to pay you for a shared expense.
          </DialogDescription>
        </DialogHeader>

        {loadingLines ? (
          <div className="flex items-center justify-center py-10 text-amber-700">
            <Loader2 className="animate-spin mr-2" size={22} />
            <span className="font-medium">Loading expenses…</span>
          </div>
        ) : fetchError ? (
          <>
            <p className="text-sm text-red-600 font-medium">{fetchError}</p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : lines.length === 0 ? (
          <>
            <p className="text-sm text-gray-600">
              No unsettled expenses where you are the payer and this member owes
              you. You cannot send a payment request from here.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <input type="hidden" {...register("expenseID")} />
            <div className="space-y-2">
              <Label htmlFor="pr-expense">Expense</Label>
              <Select
                value={expenseIdWatch}
                onValueChange={(v) => {
                  setValue("expenseID", v);
                  const ln = lines.find((l) => l.expenseID === v);
                  if (ln) {
                    const cap = ln.amountOwed;
                    const next = Math.min(suggestedAmount, cap);
                    setValue(
                      "amount",
                      next > 0 ? Math.round(next * 100) / 100 : cap,
                    );
                  }
                }}
              >
                <SelectTrigger id="pr-expense" className="rounded-xl">
                  <SelectValue placeholder="Select expense" />
                </SelectTrigger>
                <SelectContent>
                  {lines.map((l) => (
                    <SelectItem key={l.expenseID} value={l.expenseID}>
                      {(l.description || "Expense") +
                        ` · $${l.amountOwed.toFixed(2)} owed`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formState.errors.expenseID && (
                <p className="text-xs text-red-600">
                  {formState.errors.expenseID.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-amount">Amount (USD)</Label>
              <Input
                id="pr-amount"
                type="number"
                step="0.01"
                min={0.01}
                className="rounded-xl"
                {...register("amount", { valueAsNumber: true })}
              />
              {selectedLine && (
                <p className="text-xs text-gray-500">
                  Max for this expense: ${selectedLine.amountOwed.toFixed(2)}
                </p>
              )}
              {formState.errors.amount && (
                <p className="text-xs text-red-600">
                  {formState.errors.amount.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pr-message">Message (optional)</Label>
              <Textarea
                id="pr-message"
                className="rounded-xl min-h-[80px]"
                placeholder="e.g. Please send by Friday"
                {...register("message")}
              />
              {formState.errors.message && (
                <p className="text-xs text-red-600">
                  {formState.errors.message.message}
                </p>
              )}
            </div>

            {submitError && (
              <p className="text-sm text-red-600 font-medium">{submitError}</p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-amber-600 hover:bg-amber-700"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={18} />
                    Sending…
                  </>
                ) : (
                  "Send request"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

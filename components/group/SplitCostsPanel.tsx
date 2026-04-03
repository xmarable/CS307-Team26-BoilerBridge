"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Receipt,
  Pencil,
  Trash2,
  Loader2,
  DollarSign,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  calculateEqualSplit,
  applyPercentageSplit,
  validateCustomAmountSplit,
  validateCustomPercentageSplit,
} from "@/lib/splitCalculator";

type SplitType = "equal" | "custom-amount" | "custom-percentage";

interface Member {
  userId: string;
  name: string;
  role: string;
}

interface SharedCostDoc {
  _id: string;
  title: string;
  amount: number;
  currency: string;
  paidBy: string;
  participants: { userId: string }[];
  splitType: SplitType;
  date: string;
  category?: string;
  notes?: string;
  createdBy: string;
}

interface CostSplitDoc {
  _id: string;
  expenseId: string;
  totalAmount: number;
  splitType: SplitType;
  participants: { userId: string; amount: number; percentage?: number }[];
  createdBy: string;
}

interface FormState {
  title: string;
  amount: string;
  currency: string;
  date: string;
  category: string;
  paidBy: string;
  notes: string;
}

const CATEGORIES = [
  "Accommodation",
  "Food",
  "Transport",
  "Activities",
  "Shopping",
  "Entertainment",
  "Other",
];

const AVATAR_COLORS = [
  "from-blue-400 to-blue-600",
  "from-purple-400 to-purple-600",
  "from-green-400 to-green-600",
  "from-pink-400 to-pink-600",
  "from-amber-400 to-amber-600",
  "from-red-400 to-red-600",
  "from-teal-400 to-teal-600",
  "from-indigo-400 to-indigo-600",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getMemberColor(userId: string): string {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash)];
}

interface SplitCostsPanelProps {
  groupId: string;
  currentUserId: string;
  userRole: string;
}

export default function SplitCostsPanel({
  groupId,
  currentUserId,
  userRole,
}: SplitCostsPanelProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [sharedCosts, setSharedCosts] = useState<SharedCostDoc[]>([]);
  const [costSplits, setCostSplits] = useState<CostSplitDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<{
    expense: SharedCostDoc;
    split: CostSplitDoc | null;
  } | null>(null);
  const [expandedExpense, setExpandedExpense] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<FormState>({
    title: "",
    amount: "",
    currency: "USD",
    date: new Date().toISOString().split("T")[0],
    category: "",
    paidBy: currentUserId,
    notes: "",
  });
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(
    {},
  );
  const [customPercentages, setCustomPercentages] = useState<
    Record<string, string>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, costsRes, splitsRes] = await Promise.all([
        fetch(`/api/groups/${groupId}/members`, { credentials: "include" }),
        fetch(`/api/groups/${groupId}/shared-costs`, { credentials: "include" }),
        fetch(`/api/groups/${groupId}/cost-splits`, { credentials: "include" }),
      ]);

      if (membersRes.ok) {
        const data = await membersRes.json();
        setMembers(Array.isArray(data) ? data : []);
      }
      if (costsRes.ok) {
        const data = await costsRes.json();
        setSharedCosts(data.sharedCosts || []);
      }
      if (splitsRes.ok) {
        const data = await splitsRes.json();
        setCostSplits(data.costSplits || []);
      }
    } catch (err) {
      console.error("Failed to fetch split costs data:", err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreateModal = () => {
    setEditTarget(null);
    setForm({
      title: "",
      amount: "",
      currency: "USD",
      date: new Date().toISOString().split("T")[0],
      category: "",
      paidBy: currentUserId,
      notes: "",
    });
    setSelectedParticipants(members.map((m) => m.userId));
    setSplitType("equal");
    setCustomAmounts({});
    setCustomPercentages({});
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (expense: SharedCostDoc, split: CostSplitDoc | null) => {
    setEditTarget({ expense, split });
    setForm({
      title: expense.title,
      amount: expense.amount.toString(),
      currency: expense.currency,
      date: expense.date.split("T")[0],
      category: expense.category || "",
      paidBy: expense.paidBy,
      notes: expense.notes || "",
    });
    setSelectedParticipants(expense.participants.map((p) => p.userId));
    setSplitType(expense.splitType);
    if (split) {
      const amounts: Record<string, string> = {};
      const percentages: Record<string, string> = {};
      for (const p of split.participants) {
        amounts[p.userId] = p.amount.toString();
        if (p.percentage !== undefined)
          percentages[p.userId] = p.percentage.toString();
      }
      setCustomAmounts(amounts);
      setCustomPercentages(percentages);
    } else {
      setCustomAmounts({});
      setCustomPercentages({});
    }
    setFormError(null);
    setShowModal(true);
  };

  const getMemberName = (userId: string) =>
    members.find((m) => m.userId === userId)?.name || userId.slice(0, 8);

  const calculatePreview = () => {
    const total = parseFloat(form.amount) || 0;
    if (total <= 0 || selectedParticipants.length === 0) return [];

    if (splitType === "equal") {
      return calculateEqualSplit(total, selectedParticipants);
    } else if (splitType === "custom-amount") {
      return selectedParticipants.map((userId) => ({
        userId,
        amount: parseFloat(customAmounts[userId] || "0") || 0,
      }));
    } else {
      return applyPercentageSplit(
        total,
        selectedParticipants.map((userId) => ({
          userId,
          percentage: parseFloat(customPercentages[userId] || "0") || 0,
        })),
      );
    }
  };

  const handleSubmit = async () => {
    setFormError(null);
    const total = parseFloat(form.amount);

    if (!form.title.trim()) {
      setFormError("Title is required");
      return;
    }
    if (!total || total <= 0) {
      setFormError("Amount must be a positive number");
      return;
    }
    if (!form.paidBy) {
      setFormError("Please select who paid");
      return;
    }
    if (selectedParticipants.length === 0) {
      setFormError("Select at least one participant");
      return;
    }

    // Validate split-specific fields
    if (splitType === "custom-amount") {
      const preview = calculatePreview();
      const err = validateCustomAmountSplit(total, preview);
      if (err) {
        setFormError(err);
        return;
      }
    } else if (splitType === "custom-percentage") {
      const pctParticipants = selectedParticipants.map((userId) => ({
        percentage: parseFloat(customPercentages[userId] || "0") || 0,
      }));
      const err = validateCustomPercentageSplit(pctParticipants);
      if (err) {
        setFormError(err);
        return;
      }
    }

    setSubmitting(true);
    try {
      let expenseId: string;

      const expensePayload = {
        title: form.title.trim(),
        amount: total,
        currency: form.currency,
        date: form.date,
        category: form.category || undefined,
        paidBy: form.paidBy,
        participants: selectedParticipants.map((userId) => ({ userId })),
        splitType,
        notes: form.notes || undefined,
      };

      if (editTarget) {
        const res = await fetch(
          `/api/groups/${groupId}/shared-costs/${editTarget.expense._id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(expensePayload),
          },
        );
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update expense");
        }
        expenseId = editTarget.expense._id;
      } else {
        const res = await fetch(`/api/groups/${groupId}/shared-costs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(expensePayload),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create expense");
        }
        const data = await res.json();
        expenseId = data.sharedCost._id;
      }

      // Build per-participant split amounts
      const splitParticipants =
        splitType === "equal"
          ? calculateEqualSplit(total, selectedParticipants)
          : splitType === "custom-percentage"
            ? applyPercentageSplit(
                total,
                selectedParticipants.map((userId) => ({
                  userId,
                  percentage:
                    parseFloat(customPercentages[userId] || "0") || 0,
                })),
              )
            : selectedParticipants.map((userId) => ({
                userId,
                amount: parseFloat(customAmounts[userId] || "0") || 0,
              }));

      const existingSplit = editTarget?.split;
      if (existingSplit) {
        await fetch(
          `/api/groups/${groupId}/cost-splits/${existingSplit._id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              expenseId,
              participants: splitParticipants,
              splitType,
              totalAmount: total,
            }),
          },
        );
      } else {
        await fetch(`/api/groups/${groupId}/cost-splits`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            expenseId,
            participants: splitParticipants,
            splitType,
            totalAmount: total,
          }),
        });
      }

      setShowModal(false);
      await fetchData();
    } catch (err: unknown) {
      setFormError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (
    expense: SharedCostDoc,
    split: CostSplitDoc | null,
  ) => {
    if (!confirm(`Delete "${expense.title}"? This cannot be undone.`)) return;
    try {
      if (split) {
        await fetch(`/api/groups/${groupId}/cost-splits/${split._id}`, {
          method: "DELETE",
          credentials: "include",
        });
      }
      await fetch(`/api/groups/${groupId}/shared-costs/${expense._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      // Optimistic removal
      setSharedCosts((prev) => prev.filter((c) => c._id !== expense._id));
      setCostSplits((prev) =>
        prev.filter((s) => s.expenseId !== expense._id),
      );
    } catch {
      alert("Failed to delete expense. Please try again.");
    }
  };

  const canModify = (createdBy: string) =>
    createdBy === currentUserId ||
    userRole === "Leader" ||
    userRole === "Admin";

  // Summary stats
  const totalSpent = sharedCosts.reduce((sum, c) => sum + c.amount, 0);
  const myShares = costSplits.flatMap((s) =>
    s.participants.filter((p) => p.userId === currentUserId),
  );
  const myTotal = myShares.reduce((sum, p) => sum + p.amount, 0);
  const iPaid = sharedCosts
    .filter((c) => c.paidBy === currentUserId)
    .reduce((sum, c) => sum + c.amount, 0);
  const myBalance = iPaid - myTotal;

  const preview = calculatePreview();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
            <DollarSign size={20} />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">
            Split Costs
          </h2>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-bold"
        >
          <Plus size={18} className="mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">
            Total Spent
          </p>
          <p className="text-3xl font-black">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
            My Share
          </p>
          <p className="text-3xl font-black text-gray-900">
            ${myTotal.toFixed(2)}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
            My Balance
          </p>
          <p
            className={`text-3xl font-black ${myBalance >= 0 ? "text-green-600" : "text-red-500"}`}
          >
            {myBalance >= 0 ? "+" : ""}${myBalance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Expenses list */}
      {sharedCosts.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-16 text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Receipt size={28} className="text-amber-500" />
          </div>
          <p className="text-lg font-black text-gray-900 mb-2">
            No expenses yet
          </p>
          <p className="text-gray-500 mb-6">
            Add a shared expense to start splitting costs with your group.
          </p>
          <Button
            onClick={openCreateModal}
            className="bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-bold"
          >
            <Plus size={16} className="mr-2" />
            Add First Expense
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {sharedCosts.map((expense) => {
            const split = costSplits.find((s) => s.expenseId === expense._id);
            const isExpanded = expandedExpense === expense._id;
            const paidByMe = expense.paidBy === currentUserId;

            return (
              <div
                key={expense._id}
                className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <Receipt size={20} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900 text-lg truncate">
                          {expense.title}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Paid by{" "}
                          <span
                            className={`font-bold ${paidByMe ? "text-amber-600" : "text-gray-700"}`}
                          >
                            {paidByMe ? "You" : getMemberName(expense.paidBy)}
                          </span>
                          {" · "}
                          {new Date(expense.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {expense.category && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-medium">
                              {expense.category}
                            </span>
                          )}
                          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full font-medium capitalize">
                            {expense.splitType.replace("-", " ")}
                          </span>
                          <span className="text-xs text-gray-400">
                            {expense.participants.length} participant
                            {expense.participants.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-2xl font-black text-gray-900">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </p>
                      {split && (() => {
                        const myPart = split.participants.find((p) => p.userId === currentUserId);
                        const display = myPart
                          ? myPart.amount
                          : split.totalAmount / split.participants.length;
                        return (
                          <p className="text-sm text-gray-500 mt-0.5">
                            ${display.toFixed(2)}{myPart ? " your share" : "/person"}
                          </p>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Card footer: expand + actions */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                    <button
                      onClick={() =>
                        setExpandedExpense(isExpanded ? null : expense._id)
                      }
                      className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-amber-600 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                      {split ? "View split breakdown" : "No split recorded"}
                    </button>
                    {canModify(expense.createdBy) && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(expense, split || null)}
                          className="text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl"
                        >
                          <Pencil size={14} className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleDelete(expense, split || null)
                          }
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 size={14} className="mr-1" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded breakdown */}
                {isExpanded && split && (
                  <div className="bg-gray-50 border-t border-gray-100 px-6 py-5">
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
                      Split Breakdown
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {split.participants.map((p) => {
                        const name = getMemberName(p.userId);
                        const isMe = p.userId === currentUserId;
                        return (
                          <div
                            key={p.userId}
                            className={`flex items-center gap-3 p-3 rounded-2xl ${
                              isMe
                                ? "bg-amber-50 border border-amber-100"
                                : "bg-white border border-gray-100"
                            }`}
                          >
                            <Avatar className="w-8 h-8 flex-shrink-0">
                              <AvatarFallback
                                className={`bg-gradient-to-br ${getMemberColor(p.userId)} text-white text-xs font-bold`}
                              >
                                {getInitials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p
                                className={`text-xs font-bold truncate ${isMe ? "text-amber-700" : "text-gray-700"}`}
                              >
                                {isMe ? "You" : name}
                              </p>
                              <p className="text-sm font-black text-gray-900">
                                ${p.amount.toFixed(2)}
                                {p.percentage !== undefined && (
                                  <span className="text-xs text-gray-400 font-normal ml-1">
                                    ({p.percentage}%)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900">
              {editTarget ? "Edit Expense & Split" : "Add Expense & Split"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Title */}
            <div>
              <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                Title *
              </Label>
              <Input
                placeholder="e.g. Airbnb, Dinner, Uber..."
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                className="rounded-xl border-gray-200"
              />
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                  Amount *
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div>
                <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                  Currency
                </Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, currency: v }))
                  }
                >
                  <SelectTrigger className="rounded-xl border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["USD", "EUR", "GBP", "CAD", "AUD", "JPY"].map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Date + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                  Date
                </Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, date: e.target.value }))
                  }
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div>
                <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                  Category
                </Label>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v }))
                  }
                >
                  <SelectTrigger className="rounded-xl border-gray-200">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Paid by */}
            <div>
              <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                Paid by *
              </Label>
              <Select
                value={form.paidBy}
                onValueChange={(v) => setForm((f) => ({ ...f, paidBy: v }))}
              >
                <SelectTrigger className="rounded-xl border-gray-200">
                  <SelectValue placeholder="Select who paid" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.userId === currentUserId
                        ? `You (${m.name})`
                        : m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Participants */}
            <div className="border-t border-gray-100 pt-6">
              <p className="text-sm font-black text-gray-700 mb-3">
                Participants *
              </p>
              <div className="grid grid-cols-2 gap-2">
                {members.map((m) => (
                  <label
                    key={m.userId}
                    className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedParticipants.includes(m.userId)}
                      onCheckedChange={(checked) =>
                        setSelectedParticipants((prev) =>
                          checked
                            ? [...prev, m.userId]
                            : prev.filter((id) => id !== m.userId),
                        )
                      }
                      className="rounded-lg"
                    />
                    <Avatar className="w-7 h-7">
                      <AvatarFallback
                        className={`bg-gradient-to-br ${getMemberColor(m.userId)} text-white text-xs font-bold`}
                      >
                        {getInitials(m.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-bold text-gray-700 truncate">
                      {m.userId === currentUserId ? "You" : m.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Split type */}
            <div className="border-t border-gray-100 pt-6">
              <p className="text-sm font-black text-gray-700 mb-3">
                Split Type *
              </p>
              <RadioGroup
                value={splitType}
                onValueChange={(v) => setSplitType(v as SplitType)}
                className="flex gap-3 flex-wrap"
              >
                {[
                  { value: "equal", label: "Equal" },
                  { value: "custom-amount", label: "Custom Amount" },
                  { value: "custom-percentage", label: "Custom %" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border cursor-pointer transition-all font-bold text-sm ${
                      splitType === opt.value
                        ? "bg-amber-500 text-white border-amber-500"
                        : "border-gray-200 text-gray-600 hover:border-amber-200"
                    }`}
                  >
                    <RadioGroupItem value={opt.value} className="sr-only" />
                    {opt.label}
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Custom amount/percentage inputs */}
            {splitType !== "equal" && selectedParticipants.length > 0 && (
              <div className="border-t border-gray-100 pt-6">
                <p className="text-sm font-black text-gray-700 mb-3">
                  {splitType === "custom-amount"
                    ? "Custom Amounts"
                    : "Custom Percentages"}
                </p>
                <div className="space-y-2">
                  {selectedParticipants.map((userId) => {
                    const name = getMemberName(userId);
                    return (
                      <div key={userId} className="flex items-center gap-3">
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          <AvatarFallback
                            className={`bg-gradient-to-br ${getMemberColor(userId)} text-white text-xs font-bold`}
                          >
                            {getInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-bold text-gray-700 flex-1 min-w-0 truncate">
                          {userId === currentUserId ? "You" : name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            step={
                              splitType === "custom-amount" ? "0.01" : "1"
                            }
                            min="0"
                            max={
                              splitType === "custom-percentage"
                                ? "100"
                                : undefined
                            }
                            value={
                              splitType === "custom-amount"
                                ? customAmounts[userId] || ""
                                : customPercentages[userId] || ""
                            }
                            onChange={(e) => {
                              if (splitType === "custom-amount") {
                                setCustomAmounts((prev) => ({
                                  ...prev,
                                  [userId]: e.target.value,
                                }));
                              } else {
                                setCustomPercentages((prev) => ({
                                  ...prev,
                                  [userId]: e.target.value,
                                }));
                              }
                            }}
                            placeholder="0"
                            className="w-24 rounded-xl border-gray-200 text-right"
                          />
                          <span className="text-sm text-gray-500 w-6">
                            {splitType === "custom-amount"
                              ? form.currency
                              : "%"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live preview */}
            {selectedParticipants.length > 0 &&
              parseFloat(form.amount) > 0 && (
                <div className="border-t border-gray-100 pt-6">
                  <p className="text-sm font-black text-gray-700 mb-3">
                    Preview
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {preview.map((p) => (
                      <div
                        key={p.userId}
                        className={`flex items-center justify-between p-3 rounded-2xl ${
                          p.userId === currentUserId
                            ? "bg-amber-50 border border-amber-100"
                            : "bg-gray-50 border border-gray-100"
                        }`}
                      >
                        <span className="text-xs font-bold text-gray-600 truncate mr-2">
                          {p.userId === currentUserId
                            ? "You"
                            : getMemberName(p.userId)}
                        </span>
                        <span className="text-sm font-black text-gray-900 flex-shrink-0">
                          ${p.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Error message */}
            {formError && (
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-3">
                <X size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-red-700">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowModal(false)}
              className="rounded-2xl font-bold border-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-2xl font-bold"
            >
              {submitting && (
                <Loader2 size={16} className="animate-spin mr-2" />
              )}
              {editTarget ? "Save Changes" : "Save Split"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

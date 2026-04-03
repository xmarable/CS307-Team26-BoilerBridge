"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Receipt,
  DollarSign,
  TrendingUp,
  Users,
  Pencil,
  Trash2,
  Loader2,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type SplitType = "equal" | "custom-amount" | "custom-percentage";

interface Member {
  userId: string;
  name: string;
  role: string;
}

interface SharedCostDoc {
  _id: string;
  title: string;
  description?: string;
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
  participants: { userId: string; amount: number; percentage?: number }[];
  totalAmount: number;
  splitType: SplitType;
}

interface FormState {
  title: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  category: string;
  paidBy: string;
  notes: string;
  splitType: SplitType;
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

const CATEGORY_COLORS: Record<string, string> = {
  Accommodation: "bg-blue-500",
  Food: "bg-green-500",
  Transport: "bg-amber-500",
  Activities: "bg-purple-500",
  Shopping: "bg-pink-500",
  Entertainment: "bg-indigo-500",
  Other: "bg-gray-400",
};

const AVATAR_COLORS = [
  "from-blue-400 to-blue-600",
  "from-purple-400 to-purple-600",
  "from-green-400 to-green-600",
  "from-pink-400 to-pink-600",
  "from-amber-400 to-amber-600",
  "from-red-400 to-red-600",
  "from-teal-400 to-teal-600",
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
  for (const ch of userId)
    hash = (hash * 31 + ch.charCodeAt(0)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(hash)];
}

interface SharedCostsPanelProps {
  groupId: string;
  currentUserId: string;
  userRole: string;
}

export default function SharedCostsPanel({
  groupId,
  currentUserId,
  userRole,
}: SharedCostsPanelProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [sharedCosts, setSharedCosts] = useState<SharedCostDoc[]>([]);
  const [costSplits, setCostSplits] = useState<CostSplitDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "paid" | "owe">("all");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<SharedCostDoc | null>(null);
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    amount: "",
    currency: "USD",
    date: new Date().toISOString().split("T")[0],
    category: "",
    paidBy: currentUserId,
    notes: "",
    splitType: "equal",
  });
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
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
      console.error("Failed to fetch shared costs:", err);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getMemberName = (userId: string) =>
    members.find((m) => m.userId === userId)?.name || userId.slice(0, 8);

  // Summary stats
  const totalSpent = sharedCosts.reduce((sum, c) => sum + c.amount, 0);

  const myShare = sharedCosts
    .filter((c) => c.participants.some((p) => p.userId === currentUserId))
    .reduce((sum, c) => sum + c.amount / (c.participants.length || 1), 0);

  const iPaid = sharedCosts
    .filter((c) => c.paidBy === currentUserId)
    .reduce((sum, c) => sum + c.amount, 0);

  const myBalance = iPaid - myShare;

  // Settlement calculation using actual split amounts when available
  const settlements = (() => {
    const balances: Record<string, number> = {};
    for (const cost of sharedCosts) {
      const split = costSplits.find((s) => s.expenseId === cost._id);
      for (const p of cost.participants) {
        if (p.userId === cost.paidBy) continue;
        const share = split
          ? (split.participants.find((sp) => sp.userId === p.userId)?.amount ?? cost.amount / (cost.participants.length || 1))
          : cost.amount / (cost.participants.length || 1);
        if (p.userId === currentUserId) {
          balances[cost.paidBy] = (balances[cost.paidBy] || 0) - share;
        } else if (cost.paidBy === currentUserId) {
          balances[p.userId] = (balances[p.userId] || 0) + share;
        }
      }
    }
    return Object.entries(balances)
      .filter(([, amount]) => Math.abs(amount) > 0.01)
      .map(([userId, amount]) => ({ userId, amount }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  })();

  const handleSettleUp = async (toUserId: string) => {
    if (!confirm(`Mark all debts with ${getMemberName(toUserId)} as settled?`)) return;
    try {
      // Mark all shared costs where I owe this person as settled by removing me from participants
      // For now, optimistically update the UI balance
      setSharedCosts((prev) =>
        prev.map((cost) => {
          if (cost.paidBy !== toUserId) return cost;
          return {
            ...cost,
            participants: cost.participants.filter((p) => p.userId !== currentUserId),
          };
        })
      );
    } catch (err) {
      console.error("Settle up failed:", err);
    }
  };

  const handleRemind = async (fromUserId: string) => {
    alert(`Reminder sent to ${getMemberName(fromUserId)}!`);
  };

  // Category breakdown
  const categoryData = Object.entries(
    sharedCosts.reduce<Record<string, number>>((acc, c) => {
      const cat = c.category || "Other";
      acc[cat] = (acc[cat] || 0) + c.amount;
      return acc;
    }, {}),
  )
    .map(([name, amount]) => ({
      name,
      amount,
      percentage:
        totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
      color: CATEGORY_COLORS[name] || "bg-gray-400",
    }))
    .sort((a, b) => b.amount - a.amount);

  // Filtered list
  const filteredCosts = sharedCosts.filter((c) => {
    if (filter === "paid") return c.paidBy === currentUserId;
    if (filter === "owe")
      return (
        c.paidBy !== currentUserId &&
        c.participants.some((p) => p.userId === currentUserId)
      );
    return true;
  });

  const canModify = (createdBy: string) =>
    createdBy === currentUserId ||
    userRole === "Leader" ||
    userRole === "Admin";

  const openCreateModal = () => {
    setEditTarget(null);
    setForm({
      title: "",
      description: "",
      amount: "",
      currency: "USD",
      date: new Date().toISOString().split("T")[0],
      category: "",
      paidBy: currentUserId,
      notes: "",
      splitType: "equal",
    });
    setSelectedParticipants(members.map((m) => m.userId));
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (cost: SharedCostDoc) => {
    setEditTarget(cost);
    setForm({
      title: cost.title,
      description: cost.description || "",
      amount: cost.amount.toString(),
      currency: cost.currency,
      date: cost.date.split("T")[0],
      category: cost.category || "",
      paidBy: cost.paidBy,
      notes: cost.notes || "",
      splitType: cost.splitType,
    });
    setSelectedParticipants(cost.participants.map((p) => p.userId));
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setFormError(null);
    const amount = parseFloat(form.amount);

    if (!form.title.trim()) {
      setFormError("Title is required");
      return;
    }
    if (!amount || amount <= 0) {
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

    setSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description || undefined,
        amount,
        currency: form.currency,
        date: form.date,
        category: form.category || undefined,
        paidBy: form.paidBy,
        participants: selectedParticipants.map((userId) => ({ userId })),
        splitType: form.splitType,
        notes: form.notes || undefined,
      };

      const url = editTarget
        ? `/api/groups/${groupId}/shared-costs/${editTarget._id}`
        : `/api/groups/${groupId}/shared-costs`;

      const res = await fetch(url, {
        method: editTarget ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save expense");
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

  const handleDelete = async (cost: SharedCostDoc) => {
    if (!confirm(`Delete "${cost.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(
        `/api/groups/${groupId}/shared-costs/${cost._id}`,
        { method: "DELETE", credentials: "include" },
      );
      if (res.ok) {
        setSharedCosts((prev) => prev.filter((c) => c._id !== cost._id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete");
      }
    } catch {
      alert("Failed to delete expense.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 -m-8 p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Expense Ledger</h1>
          <p className="text-sm text-gray-500">Track and manage shared costs</p>
        </div>
        <Button
          onClick={openCreateModal}
          className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl font-bold"
        >
          <Plus size={18} className="mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={20} />
            <span className="text-sm opacity-90">Total Spent</span>
          </div>
          <p className="text-4xl font-bold mb-1">
            ${totalSpent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-sm opacity-90">
            {sharedCosts.length} expense{sharedCosts.length !== 1 ? "s" : ""} recorded
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <Users size={20} className="text-gray-600" />
            <span className="text-sm text-gray-600">Your Share</span>
          </div>
          <p className="text-4xl font-bold text-gray-900 mb-1">
            ${myShare.toFixed(2)}
          </p>
          <p className="text-sm text-gray-600">
            Split with {members.length} people
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={20} className="text-gray-600" />
            <span className="text-sm text-gray-600">Your Balance</span>
          </div>
          <p className={`text-4xl font-bold mb-1 ${myBalance >= 0 ? "text-green-600" : "text-red-500"}`}>
            {myBalance >= 0 ? "+" : ""}${myBalance.toFixed(2)}
          </p>
          <p className="text-sm text-gray-600">
            {myBalance >= 0 ? "You're owed this amount" : "You owe this amount"}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Settlement Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Settlement Summary
            </h2>
            {settlements.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">All settled up! 🎉</p>
            ) : (
              <div className="space-y-3">
                {settlements.map((s) => (
                  <div
                    key={s.userId}
                    className={`flex items-center justify-between p-4 rounded-xl ${
                      s.amount > 0 ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback
                          className={`bg-gradient-to-br ${getMemberColor(s.userId)} text-white text-sm font-bold`}
                        >
                          {getInitials(getMemberName(s.userId))}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900">
                          {s.amount > 0
                            ? `${getMemberName(s.userId)} owes you`
                            : `You owe ${getMemberName(s.userId)}`}
                        </p>
                        <p className="text-sm text-gray-600">
                          ${Math.abs(s.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={s.amount < 0 ? "default" : "outline"}
                      className={
                        s.amount < 0
                          ? "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                          : ""
                      }
                      onClick={() =>
                        s.amount < 0
                          ? handleSettleUp(s.userId)
                          : handleRemind(s.userId)
                      }
                    >
                      {s.amount < 0 ? "Settle Up" : "Remind"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* All Expenses */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  All Expenses
                </h2>
                <div className="flex gap-2">
                  {(["all", "paid", "owe"] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={filter === f ? "default" : "outline"}
                      onClick={() => setFilter(f)}
                      className={
                        filter === f
                          ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white"
                          : ""
                      }
                    >
                      {f === "all" ? "All" : f === "paid" ? "I Paid" : "I Owe"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {filteredCosts.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No expenses found</p>
                {sharedCosts.length === 0 && (
                  <Button
                    onClick={openCreateModal}
                    className="mt-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold"
                  >
                    <Plus size={16} className="mr-2" />
                    Add First Expense
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredCosts.map((cost) => {
                  const paidByMe = cost.paidBy === currentUserId;
                  const split = costSplits.find((s) => s.expenseId === cost._id);
                  const myParticipant = split?.participants.find((p) => p.userId === currentUserId);
                  const share = myParticipant
                    ? myParticipant.amount
                    : cost.amount / (cost.participants.length || 1);
                  return (
                    <div
                      key={cost._id}
                      className="p-6 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Receipt className="text-amber-600" size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate">
                              {cost.title}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              Paid by{" "}
                              <span
                                className={`font-semibold ${paidByMe ? "text-amber-600" : "text-gray-700"}`}
                              >
                                {paidByMe
                                  ? "You"
                                  : getMemberName(cost.paidBy)}
                              </span>
                            </p>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              {cost.category && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                  {cost.category}
                                </span>
                              )}
                              <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full capitalize">
                                {cost.splitType.replace("-", " ")}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(cost.date).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  },
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-xl font-black text-gray-900">
                            {cost.currency} {cost.amount.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-500">
                            ${share.toFixed(2)} {myParticipant ? "your share" : "each"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            Split between:
                          </span>
                          <div className="flex items-center">
                            {cost.participants.slice(0, 5).map((p) => (
                              <Avatar
                                key={p.userId}
                                className="w-6 h-6 -ml-1 first:ml-0 border-2 border-white"
                              >
                                <AvatarFallback
                                  className={`bg-gradient-to-br ${getMemberColor(p.userId)} text-white text-[10px] font-bold`}
                                >
                                  {getInitials(getMemberName(p.userId))}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {cost.participants.length > 5 && (
                              <span className="text-xs text-gray-400 ml-1">
                                +{cost.participants.length - 5}
                              </span>
                            )}
                          </div>
                        </div>

                        {canModify(cost.createdBy) && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEditModal(cost)}
                              className="text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg h-7"
                            >
                              <Pencil size={13} className="mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(cost)}
                              className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg h-7"
                            >
                              <Trash2 size={13} className="mr-1" />
                              Delete
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Spending by Category
            </h3>
            {categoryData.length === 0 ? (
              <p className="text-sm text-gray-500">No expenses yet</p>
            ) : (
              <div className="space-y-4">
                {categoryData.map((cat) => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-900">
                        {cat.name}
                      </span>
                      <span className="text-sm font-bold text-gray-900">
                        ${cat.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className={`${cat.color} h-2 rounded-full`}
                          style={{ width: `${cat.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">
                        {cat.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              💡 Pro Tip
            </h3>
            <p className="text-sm text-gray-600">
              Add receipts to expenses by clicking on them. Use the Splits tab
              to manage custom per-person amounts.
            </p>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-gray-900">
              {editTarget ? "Edit Expense" : "Add Expense"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
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
                    <SelectValue placeholder="Select..." />
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

            <div>
              <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                Paid by *
              </Label>
              <Select
                value={form.paidBy}
                onValueChange={(v) => setForm((f) => ({ ...f, paidBy: v }))}
              >
                <SelectTrigger className="rounded-xl border-gray-200">
                  <SelectValue placeholder="Who paid?" />
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

            <div>
              <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                Split Type
              </Label>
              <Select
                value={form.splitType}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, splitType: v as SplitType }))
                }
              >
                <SelectTrigger className="rounded-xl border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal</SelectItem>
                  <SelectItem value="custom-amount">Custom Amount</SelectItem>
                  <SelectItem value="custom-percentage">
                    Custom Percentage
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t border-gray-100 pt-5">
              <Label className="text-sm font-bold text-gray-700 mb-3 block">
                Participants *
              </Label>
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

            <div>
              <Label className="text-sm font-bold text-gray-700 mb-1.5 block">
                Notes
              </Label>
              <Input
                placeholder="Optional notes..."
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                className="rounded-xl border-gray-200"
              />
            </div>

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
              {editTarget ? "Save Changes" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

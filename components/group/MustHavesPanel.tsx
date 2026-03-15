"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Heart,
  Plus,
  MapPin,
  Filter,
  Trash2,
  Edit3,
  Loader2,
} from "lucide-react";

type MustHave = {
  _id: string;
  groupId: string;
  tripId?: string;
  placeId?: string;
  name: string;
  category?: string;
  address?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  priority: number;
  addedBy: string;
  status: "proposed" | "approved" | "rejected";
  createdAt?: string;
};

type Props = {
  groupId: string;
};

export default function MustHavesPanel({ groupId }: Props) {
  const [items, setItems] = useState<MustHave[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<string>("3");
  const [creating, setCreating] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<MustHave | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<string>("3");
  const [editStatus, setEditStatus] = useState<MustHave["status"]>("proposed");
  const [savingEdit, setSavingEdit] = useState(false);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    if (filterStatus !== "all") qs.set("status", filterStatus);
    if (filterCategory.trim()) qs.set("category", filterCategory.trim());
    if (filterPriority !== "all") qs.set("priority", filterPriority);
    const s = qs.toString();
    return s ? `?${s}` : "";
  }, [filterStatus, filterCategory, filterPriority]);

  async function fetchMustHaves() {
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(
        `/api/groups/${groupId}/must-haves${queryString}`,
        {
          method: "GET",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load must-haves");
      setItems(data.mustHaves ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load must-haves");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMustHaves();
  }, [groupId, queryString]);

  async function handleCreate() {
    try {
      setCreating(true);
      setErr(null);

      const res = await fetch(`/api/groups/${groupId}/must-haves`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          priority: Number(priority),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create must-have");

      setName("");
      setCategory("");
      setAddress("");
      setNotes("");
      setPriority("3");
      await fetchMustHaves();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to create must-have");
    } finally {
      setCreating(false);
    }
  }

  function openEdit(item: MustHave) {
    setEditItem(item);
    setEditNotes(item.notes ?? "");
    setEditPriority(String(item.priority ?? 3));
    setEditStatus(item.status);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!editItem) return;
    try {
      setSavingEdit(true);
      setErr(null);

      const res = await fetch(
        `/api/groups/${groupId}/must-haves/${editItem._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: editNotes.trim(),
            priority: Number(editPriority),
            status: editStatus,
          }),
        },
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update must-have");

      setEditOpen(false);
      setEditItem(null);
      await fetchMustHaves();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update must-have");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(itemId: string) {
    try {
      setErr(null);
      const res = await fetch(`/api/groups/${groupId}/must-haves/${itemId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete must-have");
      await fetchMustHaves();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to delete must-have");
    }
  }

  return (
    <div className="space-y-8">
      {/* Filters Section */}
      <div className="bg-gray-50 rounded-4xl p-6 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={16} className="text-gray-400" />
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">
            Filters
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Status</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="proposed">Proposed</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Priority</Label>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="all">All Priorities</SelectItem>
                {[1, 2, 3, 4, 5].map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    Priority {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Category</Label>
            <Input
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              placeholder="Filter category..."
              className="rounded-2xl border-gray-200 h-12 bg-white text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Create Section */}
      <div className="bg-pink-50/50 rounded-[2.5rem] p-8 border border-pink-100/50">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-pink-500 rounded-2xl text-white shadow-lg shadow-pink-200">
            <Plus size={24} />
          </div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">
            New Must-Have
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Place or activity name"
              className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Food, museum, hike..."
              className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm"
            />
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Address</Label>
            <div className="relative">
              <MapPin
                className="absolute left-4 top-4 text-gray-400"
                size={20}
              />
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St..."
                className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 pl-12 shadow-sm"
              />
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why is this a must-have?"
              className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-gray-700 font-bold ml-1">
              Priority (1-5)
            </Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="rounded-2xl border-gray-200 h-14 bg-white text-gray-900 shadow-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="1">1 (Low)</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3 (Normal)</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5 (High)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="w-full h-14 bg-linear-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black rounded-2xl shadow-xl shadow-pink-200 transition-all active:scale-95"
            >
              {creating ? "Adding…" : "Add Must-Have"}
            </Button>
          </div>
        </div>
        {err && (
          <p className="mt-4 text-sm text-red-600 font-bold text-center">
            {err}
          </p>
        )}
      </div>

      {/* Items List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-black text-gray-900 tracking-tight">
            Wishlist
          </h3>
          <Badge className="bg-pink-100 text-pink-700 border-none px-3 py-1 rounded-full font-bold">
            {items.length} Items
          </Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-pink-500" size={32} />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-200">
            <Heart className="mx-auto text-gray-300 mb-2" size={40} />
            <p className="text-gray-400 font-bold">No must-haves saved yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((it) => (
              <div
                key={it._id}
                className="group bg-white p-6 rounded-4xl border border-gray-100 shadow-sm hover:shadow-md hover:border-pink-200 transition-all relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 w-1.5 h-full ${
                    it.status === "approved"
                      ? "bg-green-500"
                      : it.status === "rejected"
                        ? "bg-red-500"
                        : "bg-pink-500"
                  }`}
                />

                <div className="flex justify-between items-start mb-3">
                  <div className="min-w-0">
                    <h4 className="font-black text-gray-900 text-lg truncate">
                      {it.name}
                    </h4>
                    {it.category && (
                      <span className="text-xs font-black text-pink-600 uppercase tracking-widest">
                        {it.category}
                      </span>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-gray-100 text-gray-600 font-bold border-none"
                  >
                    P{it.priority}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  {it.address && (
                    <p className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <MapPin size={12} /> {it.address}
                    </p>
                  )}
                  {it.notes && (
                    <p className="text-sm text-gray-600 italic leading-relaxed">
                      "{it.notes}"
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <Badge
                    className={`font-bold capitalize ${
                      it.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : it.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                    } border-none`}
                  >
                    {it.status}
                  </Badge>

                  <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(it)}
                      className="rounded-xl hover:bg-pink-50 text-gray-400 hover:text-pink-600"
                    >
                      <Edit3 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(it._id)}
                      className="rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 border-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-gray-900 tracking-tight">
              Modify Must-Have
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="font-bold text-gray-700 ml-1">Status</Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as MustHave["status"])}
              >
                <SelectTrigger className="rounded-2xl border-gray-200 h-12 bg-gray-50 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-gray-700 ml-1">
                Priority (1-5)
              </Label>
              <Select value={editPriority} onValueChange={setEditPriority}>
                <SelectTrigger className="rounded-2xl border-gray-200 h-12 bg-gray-50 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {[1, 2, 3, 4, 5].map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      Priority {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-bold text-gray-700 ml-1">Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="rounded-2xl border-gray-200 h-12 bg-gray-50 text-gray-900"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={savingEdit}
              className="rounded-xl font-bold text-gray-500"
            >
              Cancel
            </Button>
            <Button
              onClick={saveEdit}
              disabled={savingEdit}
              className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white font-black px-6 shadow-lg shadow-pink-100"
            >
              {savingEdit ? "Saving…" : "Update Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

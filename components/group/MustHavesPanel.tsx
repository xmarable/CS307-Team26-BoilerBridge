"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
      const res = await fetch(`/api/groups/${groupId}/must-haves${queryString}`, {
        method: "GET",
      });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create must-have");
      }

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

      const res = await fetch(`/api/groups/${groupId}/must-haves/${editItem._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: editNotes.trim(),
          priority: Number(editPriority),
          status: editStatus,
        }),
      });

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
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Must-haves</h2>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{items.length} items</Badge>
        </div>
      </div>

      {/* Create */}
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-900">
          <div>
            <Label className="text-gray-800">Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Place / activity name"
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div>
            <Label className="text-gray-800">Category</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Food, museum, hike..."
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div className="md:col-span-2">
            <Label className="text-gray-800">Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St..."
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div className="md:col-span-2">
            <Label className="text-gray-800">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Why is this a must-have?"
              className="text-gray-900 placeholder:text-gray-500"
            />
          </div>

          <div>
            <Label className="text-gray-800">Priority (1–5)</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="text-gray-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="text-black bg-white">
                <SelectItem value="1">1 (low)</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5 (high)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="w-full"
            >
              {creating ? "Adding…" : "Add must-have"}
            </Button>
          </div>
        </div>

        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      </Card>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <div className="w-full md:w-56 text-gray-900">
          <Label>Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-black bg-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="proposed">Proposed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:w-56 text-gray-900">
          <Label>Priority</Label>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="text-gray-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-black bg-white">
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="5">5</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-full md:flex-1 text-gray-900">
          <Label>Category</Label>
          <Input
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            placeholder="Filter by category…"
            className="text-gray-900 placeholder:text-gray-500"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-700">Loading must-haves…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-700">No must-haves yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => (
            <li
              key={it._id}
              className="border border-gray-200 rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{it.name}</p>
                  <p className="text-sm text-gray-600 truncate">
                    {it.address || it.category || "—"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-gray-700">P{it.priority}</Badge>
                  <Badge
                    variant="secondary"
                    className={
                      it.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : it.status === "rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-yellow-100 text-yellow-800"
                    }
                  >
                    {it.status}
                  </Badge>
                </div>
              </div>

              {it.notes && <p className="text-sm text-gray-700">{it.notes}</p>}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => openEdit(it)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => handleDelete(it._id)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit must-have</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-gray-800">Status</Label>
              <Select
                value={editStatus}
                onValueChange={(v) => setEditStatus(v as MustHave["status"])}
              >
                <SelectTrigger className="text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposed">Proposed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-800">Priority (1–5)</Label>
              <Select value={editPriority} onValueChange={setEditPriority}>
                <SelectTrigger className="text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-800">Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="text-gray-900 placeholder:text-gray-500"
              />
            </div>

            {err && <p className="text-sm text-red-600">{err}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={savingEdit}
            >
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
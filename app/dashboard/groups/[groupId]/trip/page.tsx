"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "flight" | "train" | "bus" | "taxi";

interface MustHaveRow {
  id: string;
  name: string;
  address: string;
}

export default function GroupTripPage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mustHaves, setMustHaves] = useState<MustHaveRow[]>([]);

  const groupId = params?.groupId as string | undefined;

  const addMustHave = () => {
    setMustHaves((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", address: "" },
    ]);
  };

  const removeMustHave = (id: string) => {
    setMustHaves((prev) => prev.filter((r) => r.id !== id));
  };

  const updateMustHave = (
    id: string,
    field: "name" | "address",
    value: string,
  ) => {
    setMustHaves((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const handleSubmit = async (e: { preventDefault(): void; currentTarget: HTMLFormElement }) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      const mustHaveList = mustHaves
        .map((r) => ({
          name: r.name.trim(),
          address: r.address.trim() || undefined,
        }))
        .filter((r) => r.name.length > 0);

      const payload = {
        groupId,
        fromCity: String(formData.get("fromCity") || "").trim(),
        toCity: String(formData.get("toCity") || "").trim(),
        fromDate: String(formData.get("fromDate") || ""),
        toDate: String(formData.get("toDate") || ""),
        mode: String(formData.get("mode") || "flight") as Mode,
        budget: Number(formData.get("budget") || 0),
        tripConfirmed: formData.get("tripConfirmed") === "on",
        mustHaves: mustHaveList,
      };

      if (!payload.fromCity || !payload.toCity || !payload.fromDate || !payload.toDate) {
        setError("Please fill all required fields.");
        setLoading(false);
        return;
      }

      if (!payload.groupId) {
        setError("Missing group context.");
        setLoading(false);
        return;
      }

      if (Number.isNaN(payload.budget) || payload.budget <= 0) {
        setError("Budget must be a positive number.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to create trip.");
        setLoading(false);
        return;
      }

      const tripId =
        typeof data?.tripID === "string" && data.tripID.length > 0
          ? data.tripID
          : "";
      const sparkReadyQuery = tripId
        ? `?sparkReady=1&tripCreated=1&tripId=${encodeURIComponent(tripId)}`
        : "?sparkReady=1&tripCreated=1";
      router.push(`/dashboard/groups/${groupId}${sparkReadyQuery}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/groups/${groupId}`}>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full h-12 w-12 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-100 transition-all"
          >
            <ChevronLeft size={28} className="text-gray-600" />
          </Button>
        </Link>
        <div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">
            Create Trip
          </h1>
          <p className="text-gray-500 font-medium mt-0.5">
            Set your route, dates, and budget for itinerary generation.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromCity" className="font-bold text-gray-700">From City</Label>
              <Input
                id="fromCity"
                name="fromCity"
                placeholder="e.g. Chicago"
                required
                className="rounded-2xl border-bb-border-input h-12 placeholder:text-bb-placeholder"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toCity" className="font-bold text-gray-700">To City</Label>
              <Input
                id="toCity"
                name="toCity"
                placeholder="e.g. Miami"
                required
                className="rounded-2xl border-bb-border-input h-12 placeholder:text-bb-placeholder"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fromDate" className="font-bold text-gray-700">From Date</Label>
              <Input
                id="fromDate"
                name="fromDate"
                type="date"
                required
                className="rounded-2xl border-bb-border-input h-12 placeholder:text-bb-placeholder"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toDate" className="font-bold text-gray-700">To Date</Label>
              <Input
                id="toDate"
                name="toDate"
                type="date"
                required
                className="rounded-2xl border-bb-border-input h-12 placeholder:text-bb-placeholder"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mode" className="font-bold text-gray-700">Transport</Label>
            <select
              id="mode"
              name="mode"
              defaultValue="flight"
              required
              className="flex h-12 w-full rounded-2xl border border-bb-border-input bg-bb-surface px-4 text-sm text-bb-text outline-none focus:border-bb-ring focus:ring-2 focus:ring-bb-ring/20"
            >
              <option value="flight">Flight</option>
              <option value="train">Train</option>
              <option value="bus">Bus</option>
              <option value="taxi">Taxi</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget" className="font-bold text-gray-700">Budget ($)</Label>
            <Input
              id="budget"
              name="budget"
              type="number"
              placeholder="e.g. 500"
              min={1}
              step={1}
              required
              className="rounded-2xl border-bb-border-input h-12 placeholder:text-bb-placeholder"
            />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
            <div className="flex items-center justify-between mb-3">
              <Label className="font-bold text-gray-700">Must-have activities</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMustHave}
                className="gap-1 rounded-xl border-amber-400/60 text-amber-700 hover:bg-amber-50"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Places or activities you don't want to miss.
            </p>
            {mustHaves.length === 0 ? (
              <p className="text-sm text-gray-400 py-1">None added yet.</p>
            ) : (
              <ul className="space-y-3">
                {mustHaves.map((row) => (
                  <li key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex-1 grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Activity or place name"
                        value={row.name}
                        onChange={(e) => updateMustHave(row.id, "name", e.target.value)}
                        className="rounded-xl border-bb-border-input placeholder:text-bb-placeholder"
                      />
                      <Input
                        placeholder="Address (optional)"
                        value={row.address}
                        onChange={(e) => updateMustHave(row.id, "address", e.target.value)}
                        className="rounded-xl border-bb-border-input placeholder:text-bb-placeholder"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMustHave(row.id)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              name="tripConfirmed"
              type="checkbox"
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 h-4 w-4"
            />
            <span className="text-sm font-bold text-gray-600">Trip confirmed?</span>
          </label>

          {error && (
            <p className="text-sm text-red-600 font-medium" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-linear-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white font-bold text-base rounded-2xl shadow-lg shadow-amber-100 transition-all active:scale-[0.98]"
          >
            <Plus className="mr-2" size={18} />
            {loading ? "Creating…" : "Create Trip"}
          </Button>
        </form>
      </div>
    </div>
  );
}

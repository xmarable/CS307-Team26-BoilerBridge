/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ChevronLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "flight" | "train" | "bus" | "taxi";

interface MustHaveRow {
  id: string;
  name: string;
  address: string;
}

export default function TripFormClient({
  groupId,
  session,
}: {
  groupId: string;
  session: any;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mustHaves, setMustHaves] = useState<MustHaveRow[]>([]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
        groupID: groupId,
        fromCity: String(formData.get("fromCity") || "").trim(),
        toCity: String(formData.get("toCity") || "").trim(),
        fromDate: String(formData.get("fromDate") || ""),
        toDate: String(formData.get("toDate") || ""),
        mode: String(formData.get("mode") || "flight") as Mode,
        budget: Number(formData.get("budget") || 0),
        tripConfirmed: formData.get("tripConfirmed") === "on",
        mustHaves: mustHaveList,
      };

      const res = await fetch("/api/trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Failed to create trip.");
        setLoading(false);
        return;
      }

      // logic: tell the server to re-fetch the tripDoc so it renders the itinerary
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar session={session} />
      <main className="max-w-xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <Link href={`/dashboard/groups/${groupId}`}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/60"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to group
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Trip</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Set your route, dates, budget, and must-have activities. This ties
            the trip to your group so itinerary generation can use it.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fromCity">From City</Label>
                <Input
                  id="fromCity"
                  name="fromCity"
                  placeholder="e.g. Chicago"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toCity">To City</Label>
                <Input
                  id="toCity"
                  name="toCity"
                  placeholder="e.g. Miami"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fromDate">From Date</Label>
                <Input id="fromDate" name="fromDate" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To Date</Label>
                <Input id="toDate" name="toDate" type="date" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mode">Transport</Label>
              <select
                id="mode"
                name="mode"
                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="flight">Flight</option>
                <option value="train">Train</option>
                <option value="bus">Bus</option>
                <option value="taxi">Taxi</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget">Budget</Label>
              <Input
                id="budget"
                name="budget"
                type="number"
                placeholder="e.g. 500"
                min={1}
                required
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-medium">Must-haves</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMustHave}
                  className="gap-1 rounded-xl"
                >
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              {mustHaves.map((row) => (
                <div key={row.id} className="flex gap-2 mt-2">
                  <Input
                    placeholder="Activity"
                    value={row.name}
                    onChange={(e) =>
                      updateMustHave(row.id, "name", e.target.value)
                    }
                  />
                  <Input
                    placeholder="Address"
                    value={row.address}
                    onChange={(e) =>
                      updateMustHave(row.id, "address", e.target.value)
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMustHave(row.id)}
                    className="text-red-500 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl h-12"
            >
              {loading ? "Creating…" : "Create Trip"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

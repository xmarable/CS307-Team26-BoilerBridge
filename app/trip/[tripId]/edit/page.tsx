"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "flight" | "train" | "bus" | "taxi";

interface MustHaveRow {
  id: string;
  name: string;
  address: string;
}

interface TripData {
  _id: string;
  fromCity: string;
  toCity: string;
  fromDate: string;
  toDate: string;
  mode: Mode;
  budget: number;
  tripConfirmed: boolean;
  mustHaves?: { name: string; address?: string }[];
}

export default function EditTripPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params?.tripId as string | undefined;
  const [trip, setTrip] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mustHaves, setMustHaves] = useState<MustHaveRow[]>([]);

  useEffect(() => {
    if (!tripId) {
      setLoading(false);
      return;
    }
    fetch(`/api/trip/${tripId}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 403 || res.status === 404) {
          throw new Error("Trip not found or you can’t edit it.");
        }
        return res.json();
      })
      .then((data: TripData) => {
        setTrip(data);
        setMustHaves(
          (data.mustHaves ?? []).map((m) => ({
            id: crypto.randomUUID(),
            name: m.name ?? "",
            address: m.address ?? "",
          }))
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tripId]);

  const addMustHave = () => {
    setMustHaves((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", address: "" },
    ]);
  };

  const removeMustHave = (id: string) => {
    setMustHaves((prev) => prev.filter((r) => r.id !== id));
  };

  const updateMustHave = (id: string, field: "name" | "address", value: string) => {
    setMustHaves((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tripId || !trip) return;
    setError(null);
    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);
      const mustHaveList = mustHaves
        .map((r) => ({ name: r.name.trim(), address: r.address.trim() || undefined }))
        .filter((r) => r.name.length > 0);

      const payload = {
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
        setSaving(false);
        return;
      }
      if (Number.isNaN(payload.budget) || payload.budget <= 0) {
        setError("Budget must be a positive number.");
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/trip/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Failed to update trip.");
        setSaving(false);
        return;
      }

      router.push("/alltrips");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-8">
        <p className="text-gray-500">Loading trip…</p>
      </div>
    );
  }

  if (error && !trip) {
    return (
      <div className="max-w-xl mx-auto p-4 md:p-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/alltrips">
          <Button variant="outline">Back to All Trips</Button>
        </Link>
      </div>
    );
  }

  if (!trip) {
    return null;
  }

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Edit Trip</h1>
        <Link href="/alltrips">
          <Button variant="ghost" size="sm">Cancel</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fromCity">From City</Label>
            <Input
              id="fromCity"
              name="fromCity"
              defaultValue={trip.fromCity}
              placeholder="e.g. Chicago"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="toCity">To City</Label>
            <Input
              id="toCity"
              name="toCity"
              defaultValue={trip.toCity}
              placeholder="e.g. Miami"
              required
              className="mt-1"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fromDate">From Date</Label>
            <Input
              id="fromDate"
              name="fromDate"
              type="date"
              defaultValue={trip.fromDate}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="toDate">To Date</Label>
            <Input
              id="toDate"
              name="toDate"
              type="date"
              defaultValue={trip.toDate}
              required
              className="mt-1"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="mode">Transport</Label>
          <select
            id="mode"
            name="mode"
            defaultValue={trip.mode}
            required
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="flight">Flight</option>
            <option value="train">Train</option>
            <option value="bus">Bus</option>
            <option value="taxi">Taxi</option>
          </select>
        </div>

        <div>
          <Label htmlFor="budget">Budget</Label>
          <Input
            id="budget"
            name="budget"
            type="number"
            defaultValue={trip.budget}
            min={1}
            step={1}
            required
            className="mt-1"
          />
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-medium">Must-have activities</Label>
            <Button type="button" variant="outline" size="sm" onClick={addMustHave} className="gap-1">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Add or edit places you don’t want to miss.
          </p>
          {mustHaves.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">No activities added yet.</p>
          ) : (
            <ul className="space-y-3">
              {mustHaves.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Activity or place name"
                      value={row.name}
                      onChange={(e) => updateMustHave(row.id, "name", e.target.value)}
                    />
                    <Input
                      placeholder="Address (optional)"
                      value={row.address}
                      onChange={(e) => updateMustHave(row.id, "address", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMustHave(row.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-center gap-2">
          <input
            name="tripConfirmed"
            type="checkbox"
            defaultChecked={trip.tripConfirmed}
            className="rounded border-gray-300"
          />
          <span className="text-sm font-medium">Trip confirmed?</span>
        </label>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <Button type="submit" disabled={saving} className="w-full bg-amber-600 hover:bg-amber-700">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}

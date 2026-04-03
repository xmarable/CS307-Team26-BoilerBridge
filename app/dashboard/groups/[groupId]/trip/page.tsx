"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
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

export default function GroupTripPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mustHaves, setMustHaves] = useState<MustHaveRow[]>([]);

  const groupId = params?.groupId as string | undefined;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

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
        groupId: groupId,
        fromCity: String(formData.get("fromCity") || "").trim(),
        toCity: String(formData.get("toCity") || "").trim(),
        fromDate: String(formData.get("fromDate") || ""),
        toDate: String(formData.get("toDate") || ""),
        mode: String(formData.get("mode") || "flight") as Mode,
        budget: Number(formData.get("budget") || 0),
        tripConfirmed: formData.get("tripConfirmed") === "on",
        mustHaves: mustHaveList,
      };

      if (
        !payload.fromCity ||
        !payload.toCity ||
        !payload.fromDate ||
        !payload.toDate
      ) {
        setError("Please fill all required fields.");
        setLoading(false);
        return;
      }

      if (!payload.groupId) {
        setError(
          "Missing group context. Open this page from your group (Trip settings).",
        );
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
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Failed to create trip.",
        );
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard/alltrips";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-900">
        <p className="text-gray-700">Loading…</p>
      </div>
    );
  }

  if (!groupId) {
    return (
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Navbar session={session} />
        <main className="max-w-xl mx-auto p-4 md:p-8">
          <p className="text-gray-700 mb-4">This trip link is invalid.</p>
          <Link href="/dashboard/groups">
            <Button className="rounded-xl">My Groups</Button>
          </Link>
        </main>
      </div>
    );
  }

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

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 text-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Trip</h1>
          <p className="text-gray-600 mb-6">
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
                  className="mt-1 text-gray-900 placeholder:text-gray-400 bg-white border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toCity">To City</Label>
                <Input
                  id="toCity"
                  name="toCity"
                  placeholder="e.g. Miami"
                  required
                  className="mt-1 text-gray-900 placeholder:text-gray-400 bg-white border-gray-300"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fromDate">From Date</Label>
                <Input
                  id="fromDate"
                  name="fromDate"
                  type="date"
                  required
                  className="mt-1 text-gray-900 bg-white border-gray-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To Date</Label>
                <Input
                  id="toDate"
                  name="toDate"
                  type="date"
                  required
                  className="mt-1 text-gray-900 bg-white border-gray-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mode">Transport</Label>
              <select
                id="mode"
                name="mode"
                defaultValue="flight"
                required
                className="flex h-9 w-full rounded-md border border-gray-300 bg-white text-gray-900 px-3 py-1 text-sm outline-none focus-visible:border-amber-500 focus-visible:ring-amber-500/30 focus-visible:ring-[3px]"
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
                step={1}
                required
                className="mt-1 text-gray-900 placeholder:text-gray-400 bg-white border-gray-300"
              />
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-medium text-gray-900">
                  Must-have activities
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMustHave}
                  className="gap-1 rounded-xl border-amber-500/50 text-amber-700 hover:bg-amber-50"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Add places or activities you don’t want to miss on this trip.
              </p>
              {mustHaves.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">
                  No activities added yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {mustHaves.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-end"
                    >
                      <div className="flex-1 grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Activity or place name"
                          value={row.name}
                          onChange={(e) =>
                            updateMustHave(row.id, "name", e.target.value)
                          }
                          className="text-gray-900 placeholder:text-gray-400 bg-white border-gray-300"
                        />
                        <Input
                          placeholder="Address (optional)"
                          value={row.address}
                          onChange={(e) =>
                            updateMustHave(row.id, "address", e.target.value)
                          }
                          className="text-gray-900 placeholder:text-gray-400 bg-white border-gray-300"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMustHave(row.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 rounded-xl"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                name="tripConfirmed"
                type="checkbox"
                className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Trip confirmed?
              </span>
            </label>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-md transition-all"
            >
              <Plus className="mr-2" size={18} />
              {loading ? "Creating…" : "Create Trip"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

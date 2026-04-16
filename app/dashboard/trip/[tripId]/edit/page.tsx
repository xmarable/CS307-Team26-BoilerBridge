"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "flight" | "train" | "bus" | "taxi";

interface TripData {
  _id: string;
  groupID: string;
  fromCity: string;
  toCity: string;
  fromDate: string;
  toDate: string;
  mode: Mode;
  budget: number;
  tripConfirmed: boolean;
  mustHaves?: {
    _id: string;
    name: string;
    address?: string;
    status?: string;
  }[];
  avoidActivities?: string[];
  avoidLocations?: string[];
  budgetMin?: number;
  budgetMax?: number;
}

function toDateInputValue(value: string | Date | undefined): string {
  if (value == null) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function EditTripPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnGroup = searchParams.get("returnGroup");
  const tripId = params?.tripId as string | undefined;
  const [trip, setTrip] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avoidActivities, setAvoidActivities] = useState<string[]>([]);
  const [avoidLocations, setAvoidLocations] = useState<string[]>([]);
  const [budgetMin, setBudgetMin] = useState<string>("");
  const [budgetMax, setBudgetMax] = useState<string>("");
  const [newAvoidActivity, setNewAvoidActivity] = useState("");
  const [newAvoidLocation, setNewAvoidLocation] = useState("");
  const [activitySuggestions, setActivitySuggestions] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<
    { _id: string; name: string; address?: string; estimatedCost?: number }[]
  >([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);

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
        setAvoidActivities(data.avoidActivities ?? []);
        setAvoidLocations(data.avoidLocations ?? []);
        setBudgetMin(data.budgetMin != null ? String(data.budgetMin) : "");
        setBudgetMax(data.budgetMax != null ? String(data.budgetMax) : "");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tripId]);

  useEffect(() => {
    fetch("/api/activities?limit=30", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { activities: [] }))
      .then((data: { activities?: { name: string }[] }) => {
        const names = (data.activities ?? []).map((a) => a.name).filter(Boolean);
        setActivitySuggestions(names);
      })
      .catch(() => setActivitySuggestions([]));
  }, []);

  useEffect(() => {
    if (tripId && trip) fetchRecommendations();
  }, [tripId, trip?._id]);

  const addAvoidActivity = () => {
    const v = newAvoidActivity.trim();
    if (v && !avoidActivities.includes(v)) {
      setAvoidActivities((prev) => [...prev, v]);
      setNewAvoidActivity("");
    }
  };
  const removeAvoidActivity = (item: string) => {
    setAvoidActivities((prev) => prev.filter((a) => a !== item));
  };
  const addAvoidLocation = () => {
    const v = newAvoidLocation.trim();
    if (v && !avoidLocations.includes(v)) {
      setAvoidLocations((prev) => [...prev, v]);
      setNewAvoidLocation("");
    }
  };
  const removeAvoidLocation = (item: string) => {
    setAvoidLocations((prev) => prev.filter((a) => a !== item));
  };

  const fetchRecommendations = () => {
    if (!tripId) return;
    setRecommendationsLoading(true);
    fetch(`/api/trip/budget-recommendations?tripId=${tripId}&limit=20`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : { recommendations: [] }))
      .then((data: { recommendations?: { _id: string; name: string; address?: string; estimatedCost?: number }[] }) => {
        setRecommendations(data.recommendations ?? []);
      })
      .catch(() => setRecommendations([]))
      .finally(() => setRecommendationsLoading(false));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!tripId || !trip) return;
    setError(null);
    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);

      const bMinRaw = budgetMin.trim();
      const bMaxRaw = budgetMax.trim();
      let budgetMinPayload: number | null | undefined;
      let budgetMaxPayload: number | null | undefined;
      if (bMinRaw === "") {
        budgetMinPayload = null;
      } else {
        const n = Number(bMinRaw);
        if (Number.isNaN(n) || n < 0) {
          setError("Budget range minimum must be a non‑negative number or empty.");
          setSaving(false);
          return;
        }
        budgetMinPayload = n;
      }
      if (bMaxRaw === "") {
        budgetMaxPayload = null;
      } else {
        const n = Number(bMaxRaw);
        if (Number.isNaN(n) || n < 0) {
          setError("Budget range maximum must be a non‑negative number or empty.");
          setSaving(false);
          return;
        }
        budgetMaxPayload = n;
      }
      if (
        typeof budgetMinPayload === "number" &&
        typeof budgetMaxPayload === "number" &&
        budgetMaxPayload < budgetMinPayload
      ) {
        setError("Budget range maximum must be greater than or equal to minimum.");
        setSaving(false);
        return;
      }

      const payload = {
        fromCity: String(formData.get("fromCity") || "").trim(),
        toCity: String(formData.get("toCity") || "").trim(),
        fromDate: String(formData.get("fromDate") || ""),
        toDate: String(formData.get("toDate") || ""),
        mode: String(formData.get("mode") || "flight") as Mode,
        budget: Number(formData.get("budget") || 0),
        tripConfirmed: formData.get("tripConfirmed") === "on",
        avoidActivities,
        avoidLocations,
        budgetMin: budgetMinPayload,
        budgetMax: budgetMaxPayload,
      };

      if (
        !payload.fromCity ||
        !payload.toCity ||
        !payload.fromDate ||
        !payload.toDate
      ) {
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
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Failed to update trip.",
        );
        setSaving(false);
        return;
      }

      if (returnGroup && tripId) {
        router.push(
          `/dashboard/groups/${encodeURIComponent(returnGroup)}?tripId=${encodeURIComponent(tripId)}&prefsUpdated=1`,
        );
      } else {
        router.push("/dashboard/alltrips");
      }
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
        <Link href="/dashboard/alltrips">
          <Button variant="outline">Back to All Trips</Button>
        </Link>
      </div>
    );
  }

  if (!trip) {
    return null;
  }

  const backHref = returnGroup
    ? `/dashboard/groups/${encodeURIComponent(returnGroup)}${tripId ? `?tripId=${encodeURIComponent(tripId)}` : ""}`
    : "/dashboard/alltrips";

  return (
    <div className="max-w-xl mx-auto p-4 md:p-8">
      <div className="mb-4">
        <Button variant="ghost" size="sm" className="gap-1 -ml-2 text-gray-700" asChild>
          <Link href={backHref}>
            <ChevronLeft className="h-4 w-4" />
            {returnGroup ? "Back to itinerary" : "Back to all trips"}
          </Link>
        </Button>
      </div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {returnGroup ? "Edit trip preferences" : "Edit trip"}
        </h1>
        <Link href={backHref}>
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
        </Link>
      </div>

      <form key={trip._id} onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="fromCity">From City</Label>
            <Input
              id="fromCity"
              name="fromCity"
              defaultValue={trip.fromCity}
              placeholder="e.g. Chicago"
              required
              className="mt-1 text-gray-900 bg-white border-gray-300"
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
              className="mt-1 text-gray-900 bg-white border-gray-300"
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
              defaultValue={toDateInputValue(trip.fromDate)}
              required
              className="mt-1 text-gray-900 bg-white border-gray-300"
            />
          </div>
          <div>
            <Label htmlFor="toDate">To Date</Label>
            <Input
              id="toDate"
              name="toDate"
              type="date"
              defaultValue={toDateInputValue(trip.toDate)}
              required
              className="mt-1 text-gray-900 bg-white border-gray-300"
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
            className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm text-gray-900 shadow-sm"
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
            className="mt-1 text-gray-900 bg-white border-gray-300"
          />
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <Label className="text-base font-medium">Activity preferences (US14)</Label>
          <p className="text-sm text-gray-500 mt-1 mb-3">
            Mark activities or locations to avoid; suggestions will respect your budget range.
          </p>
          <div className="space-y-4">
            <div>
              <Label className="text-sm">Activities to avoid</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                <Input
                  placeholder="Type or select activity"
                  value={newAvoidActivity}
                  onChange={(e) => setNewAvoidActivity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAvoidActivity())}
                  className="max-w-[200px]"
                />
                <select
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-sm h-9"
                  value=""
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v && !avoidActivities.includes(v)) {
                      setAvoidActivities((prev) => [...prev, v]);
                    }
                  }}
                >
                  <option value="">Suggestions…</option>
                  {activitySuggestions
                    .filter((s) => !avoidActivities.includes(s))
                    .slice(0, 15)
                    .map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                <Button type="button" variant="outline" size="sm" onClick={addAvoidActivity}>
                  Add
                </Button>
              </div>
              {avoidActivities.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {avoidActivities.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeAvoidActivity(item)}
                        className="hover:text-red-600"
                        aria-label={`Remove ${item}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-sm">Locations to avoid</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder="e.g. Downtown, Airport"
                  value={newAvoidLocation}
                  onChange={(e) => setNewAvoidLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAvoidLocation())}
                  className="max-w-[200px]"
                />
                <Button type="button" variant="outline" size="sm" onClick={addAvoidLocation}>
                  Add
                </Button>
              </div>
              {avoidLocations.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {avoidLocations.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm"
                    >
                      {item}
                      <button
                        type="button"
                        onClick={() => removeAvoidLocation(item)}
                        className="hover:text-red-600"
                        aria-label={`Remove ${item}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="budgetMin" className="text-sm">Budget range (min $)</Label>
                <Input
                  id="budgetMin"
                  type="number"
                  min={0}
                  placeholder="Optional"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="budgetMax" className="text-sm">Budget range (max $)</Label>
                <Input
                  id="budgetMax"
                  type="number"
                  min={0}
                  placeholder="Optional"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-medium">Budget suggestions</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fetchRecommendations}
              disabled={recommendationsLoading}
            >
              {recommendationsLoading ? "Loading…" : "Refresh suggestions"}
            </Button>
          </div>
          <p className="text-sm text-gray-500 mb-2">
            Recommendations based on your avoid list and budget range. Update preferences above and refresh.
          </p>
          {recommendations.length === 0 && !recommendationsLoading && (
            <p className="text-sm text-gray-400 py-2">No suggestions yet. Click Refresh.</p>
          )}
          {recommendations.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {recommendations.map((r) => (
                <li key={r._id} className="flex justify-between gap-2">
                  <span className="font-medium">{r.name}</span>
                  {r.estimatedCost != null && (
                    <span className="text-gray-500">${r.estimatedCost}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <Label className="text-base font-medium">Must-have activities</Label>
          <p className="text-sm text-gray-500 mt-1 mb-3">
            These are stored on your group. Add or approve them from the group
            page so Spark itinerary generation can include them.
          </p>
          {(trip.mustHaves ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-2">None yet for this group.</p>
          ) : (
            <ul className="space-y-2 text-sm mb-4">
              {(trip.mustHaves ?? []).map((m) => (
                <li
                  key={m._id}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-2 last:border-0"
                >
                  <span className="font-medium text-gray-900">{m.name}</span>
                  {m.status && (
                    <span className="text-xs uppercase text-gray-500">{m.status}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {trip.groupID ? (
            <Button type="button" variant="outline" size="sm" className="rounded-xl" asChild>
              <Link href={`/dashboard/groups/${encodeURIComponent(trip.groupID)}`}>
                Manage must-haves on group
              </Link>
            </Button>
          ) : null}
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

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={saving}
          className="w-full bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-md"
        >
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </form>
    </div>
  );
}

export default function EditTripPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-xl mx-auto p-8 text-gray-600">Loading preferences…</div>
      }
    >
      <EditTripPageContent />
    </Suspense>
  );
}

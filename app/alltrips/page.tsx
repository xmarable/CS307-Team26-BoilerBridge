"use client";

import { useEffect, useMemo, useState } from "react";

type Trip = {
  _id: string;
  fromCity: string;
  toCity: string;
  fromDate: string; 
  toDate: string;   
  mode: "flight" | "train" | "bus" | "taxi";
  budget: number;
  tripConfirmed: boolean;
  createdAt?: string;
};

function fmtDate(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function fmtMoney(n: number) {
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function Badge({ confirmed }: { confirmed: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
        confirmed
          ? "border-emerald-300/40 bg-emerald-500/10 text-emerald-200"
          : "border-amber-300/40 bg-amber-500/10 text-amber-200",
      ].join(" ")}
    >
      {confirmed ? "Confirmed" : "Pending"}
    </span>
  );
}

export default function AllTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tripCountLabel = useMemo(
    () => `${trips.length} trip${trips.length === 1 ? "" : "s"}`,
    [trips.length]
  );

  async function loadTrips() {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/trip", {
        method: "GET",
        credentials: "include", // makes cookie/session behavior explicit
        headers: { "Accept": "application/json" },
      });

      if (res.status === 401) {
        setTrips([]);
        setError("You’re not signed in. Please sign in to view your trips.");
        return;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "Failed to fetch trips");
      }

      const data = (await res.json()) as Trip[];
      setTrips(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrips();
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">All Trips</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Your saved trips, newest first.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-full border border-zinc-800 bg-zinc-900/40 px-3 py-1 text-sm text-zinc-200">
              {tripCountLabel}
            </span>
            <button
              onClick={loadTrips}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-700 hover:bg-zinc-900/70"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* States */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
              >
                <div className="h-5 w-2/3 rounded bg-zinc-800" />
                <div className="mt-3 h-4 w-1/2 rounded bg-zinc-800" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-xl bg-zinc-900/60 ring-1 ring-zinc-800" />
                  <div className="h-16 rounded-xl bg-zinc-900/60 ring-1 ring-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-4 text-red-200">
            <div className="font-medium">Couldn’t load trips</div>
            <div className="mt-1 text-sm opacity-90">{error}</div>
            <button
              onClick={loadTrips}
              className="mt-3 rounded-xl border border-red-900/60 bg-red-900/20 px-4 py-2 text-sm font-medium text-red-100 transition hover:bg-red-900/30"
            >
              Try again
            </button>
          </div>
        ) : trips.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="text-lg font-medium">No trips yet</div>
            <div className="mt-1 text-sm text-zinc-400">
              Create a trip and it will show up here.
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {trips.map((t) => (
              <div
                key={t._id}
                className="group rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 shadow-sm transition hover:border-zinc-700 hover:bg-zinc-900/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold">
                      {t.fromCity} <span className="text-zinc-500">→</span>{" "}
                      {t.toCity}
                    </div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {fmtDate(t.fromDate)} — {fmtDate(t.toDate)}
                    </div>
                  </div>

                  <Badge confirmed={t.tripConfirmed} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="text-xs text-zinc-500">Mode</div>
                    <div className="mt-1 font-medium capitalize">{t.mode}</div>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="text-xs text-zinc-500">Budget</div>
                    <div className="mt-1 font-medium">{fmtMoney(t.budget)}</div>
                  </div>
                </div>

                {t.createdAt && (
                  <div className="mt-4 text-xs text-zinc-500">
                    Created {fmtDate(t.createdAt)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
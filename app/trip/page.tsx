"use client";

import { useState } from "react";

type Mode = "flight" | "train" | "bus" | "taxi";

export default function TripPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData(e.currentTarget);

      const payload = {
        fromCity: String(formData.get("fromCity") || "").trim(),
        toCity: String(formData.get("toCity") || "").trim(),
        fromDate: String(formData.get("fromDate") || ""), // YYYY-MM-DD
        toDate: String(formData.get("toDate") || ""),     // YYYY-MM-DD
        mode: String(formData.get("mode") || "flight") as Mode,
        budget: Number(formData.get("budget") || 0),
        tripConfirmed: formData.get("tripConfirmed") === "on",
      };

      if (!payload.fromCity || !payload.toCity || !payload.fromDate || !payload.toDate) {
        setError("Please fill all required fields.");
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
        // if you later return zod flatten() from API, this may be an object
        setError(typeof data?.error === "string" ? data.error : "Failed to create trip.");
        setLoading(false);
        return;
      }

      window.location.href = "/alltrips";
    } catch (err: any) {
      setError(err?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: "40px auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 16 }}>
        Create Trip
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input name="fromCity" placeholder="From City" required />
        <input name="toCity" placeholder="To City" required />

        <div style={{ display: "grid", gap: 8 }}>
          <label>
            From Date
            <input name="fromDate" type="date" required />
          </label>

          <label>
            To Date
            <input name="toDate" type="date" required />
          </label>
        </div>

        <select name="mode" defaultValue="flight" required>
          <option value="flight">Flight</option>
          <option value="train">Train</option>
          <option value="bus">Bus</option>
          <option value="taxi">Taxi</option>
        </select>

        <input
          name="budget"
          type="number"
          placeholder="Budget"
          min={1}
          step={1}
          required
        />

        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input name="tripConfirmed" type="checkbox" />
          Trip Confirmed?
        </label>

        {error && (
          <div style={{ color: "crimson", fontSize: 14 }}>{error}</div>
        )}

        <button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Trip"}
        </button>
      </form>
    </div>
  );
}
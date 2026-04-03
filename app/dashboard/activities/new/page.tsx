"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, MapPin, Info, Plus } from "lucide-react";

export default function AddActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Keep your existing formData logic and comments intact
      const formData = new FormData(e.currentTarget);
      const name = String(formData.get("name") || "").trim();
      const address = String(formData.get("address") || "").trim() || undefined;
      const placeId = String(formData.get("placeId") || "").trim() || undefined;

      if (!name) {
        setError("Name is required.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, placeId }),
        credentials: "include", // makes cookie/session behavior explicit
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          typeof data?.error === "string"
            ? data.error
            : "Failed to create activity.";
        const details = data?.details?.fieldErrors?.name?.[0];
        setError(details || msg);
        setLoading(false);
        return;
      }

      const activityId = data?.activity?._id;
      if (activityId) {
        router.push(`/dashboard/activities/${activityId}`);
      } else {
        setError("Activity created but could not redirect.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 font-bold animate-pulse">Loading…</p>
      </div>
    );
  }

  const inputStyles =
    "rounded-xl border-gray-200 bg-gray-50/50 focus:ring-amber-500 focus:border-amber-500 py-6 text-black placeholder:text-gray-300";

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      {/* Navigation & Header */}
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-sm font-black text-gray-400 hover:text-amber-600 transition-colors mb-6 group"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </Link>

        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
          Add Activity
        </h1>
        <p className="text-gray-500 mt-2">
          Add a place or activity. Others can view it and see reviews.
        </p>
      </div>

      {/* Main Form Card */}
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="name"
                className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1"
              >
                Activity Name *
              </Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. South Beach, MoMA, Trail Hike"
                required
                className={inputStyles}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="address"
                className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1"
              >
                Address (optional)
              </Label>
              <div className="relative">
                <MapPin
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                  size={18}
                />
                <Input
                  id="address"
                  name="address"
                  placeholder="e.g. 123 Main St, Miami, FL"
                  className={`${inputStyles} pl-12`}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="placeId"
                className="text-sm font-black text-gray-400 uppercase tracking-widest ml-1"
              >
                Place ID (optional)
              </Label>
              <div className="relative">
                <Info
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300"
                  size={18}
                />
                <Input
                  id="placeId"
                  name="placeId"
                  placeholder="External place identifier"
                  className={`${inputStyles} pl-12`}
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold animate-in fade-in slide-in-from-top-1"
              role="alert"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-gray-900 hover:bg-amber-600 text-white rounded-2xl font-black text-lg transition-all active:scale-[0.98] shadow-lg shadow-gray-200"
          >
            {loading ? (
              <span className="flex items-center gap-2">Creating…</span>
            ) : (
              <span className="flex items-center gap-2">
                <Plus size={20} /> Add Activity
              </span>
            )}
          </Button>
        </form>

        <div className="mt-8 pt-8 border-t border-gray-50 text-center">
          <Link
            href="/dashboard/activities"
            className="text-sm font-black text-gray-400 hover:text-amber-600 transition-colors uppercase tracking-widest"
          >
            Browse all activities
          </Link>
        </div>
      </div>
    </div>
  );
}

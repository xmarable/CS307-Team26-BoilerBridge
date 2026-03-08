"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";

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
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = typeof data?.error === "string" ? data.error : "Failed to create activity.";
        const details = data?.details?.fieldErrors?.name?.[0];
        setError(details || msg);
        setLoading(false);
        return;
      }

      const activityId = data?.activity?._id;
      if (activityId) {
        router.push(`/activities/${activityId}`);
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
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar session={session} />
      <main className="max-w-xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2">
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Add Activity</h1>
        <p className="text-gray-600 mb-6">
          Add a place or activity. Others can view it and see reviews.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g. South Beach, MoMA, Trail Hike"
              required
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address (optional)</Label>
            <Input
              id="address"
              name="address"
              placeholder="e.g. 123 Main St, Miami, FL"
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="placeId">Place ID (optional)</Label>
            <Input
              id="placeId"
              name="placeId"
              placeholder="External place identifier"
              className="w-full"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? "Creating…" : "Add Activity"}
          </Button>
        </form>

        <p className="mt-6 text-sm text-gray-500">
          <Link href="/activities" className="text-amber-600 hover:underline">
            Browse all activities
          </Link>
        </p>
      </main>
    </div>
  );
}

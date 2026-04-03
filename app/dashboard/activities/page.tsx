"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, MapPin, Plus } from "lucide-react";

interface Activity {
  _id: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount: number;
}

export default function ActivitiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
      return;
    }
    if (status !== "authenticated") return;

    fetch("/api/activities", { credentials: "include" })
      .then((res) =>
        res.ok ? res.json() : Promise.reject(new Error("Failed to load")),
      )
      .then((data) => setActivities(data.activities ?? []))
      .catch(() => setError("Failed to load activities."))
      .finally(() => setLoading(false));
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2">
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
          <Link href="/activities/new">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Activity
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Browse Activities
        </h1>
        <p className="text-gray-600 mb-6">
          Places and activities added by the community. Click to see reviews.
        </p>

        {loading && <p className="text-gray-500">Loading…</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && activities.length === 0 && (
          <p className="text-gray-500">
            No activities yet. Be the first to add one!
          </p>
        )}
        {!loading && !error && activities.length > 0 && (
          <ul className="space-y-3">
            {activities.map((a) => (
              <li key={a._id}>
                <Link href={`/activities/${a._id}`}>
                  <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-300 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{a.name}</p>
                        {a.address && (
                          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {a.address}
                          </p>
                        )}
                        {a.reviewCount > 0 && (
                          <p className="text-xs text-amber-600 mt-1">
                            {a.reviewCount} review
                            {a.reviewCount !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                      <span className="text-amber-500 text-sm font-medium shrink-0">
                        View →
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

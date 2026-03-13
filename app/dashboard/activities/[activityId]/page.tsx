"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { ActivitySummaryCard } from "@/components/ActivitySummaryCard";
import { ActivityReviews } from "@/components/ActivityReviews";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function ActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const activityId = params?.activityId as string | undefined;
  const [name, setName] = useState<string>("Activity");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
      return;
    }
  }, [status, router]);

  useEffect(() => {
    if (!activityId) return;
    fetch(`/api/activities/${activityId}/reviews`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.name) setName(data.name);
      })
      .catch(() => {});
  }, [activityId]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (!activityId) {
    router.replace("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar session={session} />
      <main className="max-w-2xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2">
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{name}</h1>
        <p className="text-sm text-gray-500 mb-6">Summary and reviews</p>
        <div className="space-y-6">
          <ActivitySummaryCard activityId={activityId} />
          <ActivityReviews
          activityId={activityId}
          currentUserDisplayName={
            (session?.user as { name?: string })?.name ||
            (session?.user as { username?: string })?.username ||
            null
          }
        />
        </div>
      </main>
    </div>
  );
}

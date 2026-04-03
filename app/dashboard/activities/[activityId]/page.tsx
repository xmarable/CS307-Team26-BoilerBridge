"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ActivitySummaryCard } from "@/components/ActivitySummaryCard";
import { ActivityReviews } from "@/components/ActivityReviews";
import { ActivityDetailContent } from "@/components/ActivityDetailContent";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function ActivityPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const activityId = params?.activityId as string | undefined;
  const [paramsReady, setParamsReady] = useState(false);

  useEffect(() => {
    setParamsReady(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (!paramsReady || status !== "authenticated" || !session) return;
    if (!activityId) {
      router.replace("/dashboard");
    }
  }, [paramsReady, status, session, activityId, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (!activityId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-2xl mx-auto p-4 md:p-8 pb-16">
        <div className="mb-6">
          <Link href="/dashboard/activities">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2">
              <ChevronLeft className="h-4 w-4" />
              Back to activities
            </Button>
          </Link>
        </div>
        <div className="space-y-8">
          <ActivityDetailContent activityId={activityId} />
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

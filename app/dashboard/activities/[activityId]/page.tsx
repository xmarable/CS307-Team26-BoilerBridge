"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

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

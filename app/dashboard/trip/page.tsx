"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";

/**
 * Trip creation must include a group in the URL so `groupId` is sent to POST /api/trip.
 * Use `/dashboard/groups/[groupId]/trip` (e.g. from a group’s “Trip settings” link).
 */
export default function TripLandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-900">
        <p className="text-gray-700">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Navbar session={session} />
      <main className="max-w-xl mx-auto p-4 md:p-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 -ml-2 text-gray-700 hover:text-gray-900 hover:bg-gray-200/60"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 text-gray-900">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Plan a trip</h1>
          <p className="text-gray-600 mb-6">
            Open one of your groups and choose <strong>Trip settings</strong> in
            the Timeline section, or go to My Groups and pick a group. The trip
            form needs your group in the URL so it can power itinerary
            generation.
          </p>
          <Link href="/dashboard/groups">
            <Button className="w-full bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium rounded-xl shadow-md">
              My Groups
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

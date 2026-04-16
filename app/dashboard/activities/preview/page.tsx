"use client";

import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ActivityDetailContent } from "@/components/ActivityDetailContent";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

function PreviewInner() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const placeId = searchParams.get("placeId")?.trim();
  const name = searchParams.get("name")?.trim() || undefined;
  const address = searchParams.get("address")?.trim() || undefined;

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin");
    }
  }, [status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  if (!placeId) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 text-center"
        role="alert"
      >
        <p className="font-medium text-gray-900">Missing place</p>
        <p className="text-sm text-gray-600 mt-1">
          Open this page from search results, or browse activities to pick a place.
        </p>
        <Button className="mt-4 bg-amber-600 hover:bg-amber-700 text-white" size="sm" asChild>
          <Link href="/dashboard/activities">Browse activities</Link>
        </Button>
      </div>
    );
  }

  return (
    <ActivityDetailContent
      previewPlaceId={placeId}
      previewName={name}
      previewAddress={address}
    />
  );
}

export default function ActivityPreviewPage() {
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
        <Suspense
          fallback={
            <div className="py-12 text-center text-gray-600">Loading preview…</div>
          }
        >
          <PreviewInner />
        </Suspense>
      </main>
    </div>
  );
}

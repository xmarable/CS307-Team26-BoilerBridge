"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type Publication = {
  publicItineraryId: string;
  isPublic: boolean;
  ownerId: string;
};

type Props = {
  sourceType: "trip" | "group";
  sourceId: string;
  /** When false, controls are hidden (e.g. viewer role on group). */
  canPublish: boolean;
  /** Trip must have primary activities; group must have generated itinerary events. */
  hasItineraryContent: boolean;
};

export function ItinerarySourcePublishControls({
  sourceType,
  sourceId,
  canPublish,
  hasItineraryContent,
}: Props) {
  const { data: session, status } = useSession();
  const userId = (session?.user as { userId?: string } | undefined)?.userId;

  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const qs = new URLSearchParams({ sourceType, sourceId });
    const res = await fetch(`/api/itineraries/publish?${qs}`, {
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPublication(null);
      return;
    }
    setPublication((data?.publication as Publication | null) ?? null);
  }, [sourceType, sourceId]);

  useEffect(() => {
    if (status === "loading") return;
    if (!userId || !canPublish) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, canPublish, refresh, status]);

  if (!canPublish) return null;

  const isPublisher =
    publication && userId && String(publication.ownerId) === String(userId);
  const publishedAndLive = publication?.isPublic === true;

  async function handlePublish() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/itineraries/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceType, sourceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof data?.error === "string" ? data.error : "Publish failed.");
        return;
      }
      setMessage("Published to the public feed.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleSetPublic(next: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/itineraries/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sourceType, sourceId, isPublic: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof data?.error === "string" ? data.error : "Update failed.");
        return;
      }
      setMessage(
        next ? "Itinerary is public again." : "Removed from the public feed.",
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking publish status…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/40 px-4 py-3 space-y-2">
      <p className="text-sm font-bold text-gray-800">Share itinerary</p>
      <p className="text-xs text-gray-600">
        {hasItineraryContent
          ? "Publish a snapshot to the public feed. Updating the live plan won’t change past snapshots until you publish again."
          : "Add a primary itinerary (trip) or generate a group itinerary before publishing."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-xl bg-amber-600 hover:bg-amber-700"
          disabled={busy || !hasItineraryContent}
          onClick={() => void handlePublish()}
        >
          {busy ? "Working…" : publication ? "Update snapshot" : "Publish"}
        </Button>
        {publication && isPublisher && publishedAndLive ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={busy}
            onClick={() => void handleSetPublic(false)}
          >
            Unpublish
          </Button>
        ) : null}
        {publication && isPublisher && !publishedAndLive ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-xl"
            disabled={busy}
            onClick={() => void handleSetPublic(true)}
          >
            Publish again
          </Button>
        ) : null}
        {publication?.isPublic ? (
          <Button type="button" size="sm" variant="ghost" className="rounded-xl" asChild>
            <Link href={`/dashboard/public-itineraries/${publication.publicItineraryId}`}>
              View on feed
            </Link>
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className="text-xs font-medium text-gray-700" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

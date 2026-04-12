"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Eye, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RainyDayToggle } from "@/components/RainyDayToggle";

type DetailResponse = {
  publicItineraryId: string;
  title: string;
  subtitle: string;
  views: number;
  publishedAt: string;
  sourceType: "trip" | "group";
  sourceId: string;
  snapshot: Record<string, unknown>;
  ownerUsername: string;
  isOwner: boolean;
  isPublic?: boolean;
};

export default function PublicItineraryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const publicId = params?.publicId as string | undefined;
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unpublishing, setUnpublishing] = useState(false);
  const viewRecorded = useRef(false);

  useEffect(() => {
    if (!publicId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/itineraries/public/${publicId}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.error || "Could not load this itinerary.");
        }
        if (!cancelled) setData(json as DetailResponse);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Something went wrong.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicId]);

  useEffect(() => {
    if (!publicId || !data || viewRecorded.current) return;
    viewRecorded.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/itineraries/public/${publicId}/view`, {
          method: "POST",
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && typeof json.views === "number") {
          setData((prev) => (prev ? { ...prev, views: json.views } : prev));
        }
      } catch {
        /* ignore view tracking failures */
      }
    })();
  }, [publicId, data]);

  async function handleUnpublish() {
    if (!data) return;
    setUnpublishing(true);
    try {
      const res = await fetch("/api/itineraries/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sourceType: data.sourceType,
          sourceId: data.sourceId,
          isPublic: false,
        }),
      });
      if (res.ok) {
        router.push("/dashboard/public-itineraries");
        return;
      }
    } finally {
      setUnpublishing(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto flex items-center gap-2 text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-4">
        <p className="text-red-600 font-medium">{error || "Not found."}</p>
        <Link href="/dashboard/public-itineraries">
          <Button variant="outline" className="rounded-xl">
            Back to feed
          </Button>
        </Link>
      </div>
    );
  }

  const snap = data.snapshot;
  const primary = snap?.primaryItinerary as unknown[] | undefined;
  const rainy = snap?.rainyDayItinerary as unknown[] | undefined;
  const groupEvents = snap?.groupEvents as
    | {
        title: string;
        description?: string;
        startTime: string;
        endTime: string;
        location?: string;
      }[]
    | undefined;

  const isTripLayout =
    data.sourceType === "trip" ||
    (Array.isArray(primary) && (primary?.length ?? 0) > 0);

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <Link href="/dashboard/public-itineraries">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 -ml-2 text-gray-700 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Public feed
          </Button>
        </Link>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">
          {data.title}
        </h1>
        {data.subtitle ? (
          <div className="mt-2 text-sm font-bold text-gray-400 flex items-center gap-2">
            <Calendar size={16} />
            {data.subtitle}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-bold text-gray-500">
          <span className="inline-flex items-center gap-1">
            <User size={16} className="text-gray-400" />
            @{data.ownerUsername}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye size={16} className="text-gray-400" />
            {data.views} views
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
            Read-only
          </span>
          {data.isOwner && data.isPublic !== false ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
              disabled={unpublishing}
              onClick={() => void handleUnpublish()}
            >
              {unpublishing ? "Removing…" : "Remove from public feed"}
            </Button>
          ) : null}
        </div>
      </div>

      {isTripLayout && Array.isArray(primary) ? (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8">
          <RainyDayToggle
            trip={{
              primaryItinerary: primary,
              rainyDayItinerary: Array.isArray(rainy) ? rainy : [],
            }}
          />
        </div>
      ) : null}

      {!isTripLayout && Array.isArray(groupEvents) && groupEvents.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight px-1">
            Itinerary
          </h2>
          <ul className="space-y-3">
            {groupEvents.map((ev, i) => (
              <li key={`${ev.title}-${i}`}>
                <Card className="rounded-2xl border border-gray-100 shadow-sm">
                  <CardContent className="p-5">
                    <p className="font-bold text-gray-900">{ev.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(ev.startTime).toLocaleString()} —{" "}
                      {new Date(ev.endTime).toLocaleString()}
                    </p>
                    {ev.location ? (
                      <p className="text-sm text-gray-600 mt-2">{ev.location}</p>
                    ) : null}
                    {ev.description ? (
                      <p className="text-sm text-gray-500 mt-2">{ev.description}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isTripLayout && (!groupEvents || groupEvents.length === 0) ? (
        <p className="text-gray-500 text-sm">
          This shared itinerary has no displayable events in the saved snapshot.
        </p>
      ) : null}
    </div>
  );
}

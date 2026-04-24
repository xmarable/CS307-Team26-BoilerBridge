"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Eye, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FeedItem = {
  publicItineraryId: string;
  title: string;
  subtitle: string;
  views: number;
  publishedAt: string;
  sourceType: string;
  ownerUsername: string;
};

export default function PublicItinerariesFeedPage() {
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: number, s: "latest" | "popular") => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        page: String(p),
        limit: "12",
        sort: s,
      });
      const res = await fetch(`/api/itineraries/public?${qs}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load itineraries.");
      }
      setItems(data.items ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setHasMore(!!data.hasMore);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page, sort);
  }, [load, page, sort]);

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-amber-50 rounded-xl text-amber-600 shadow-sm">
              <Sparkles size={24} />
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight">
              Public itineraries
            </h1>
          </div>
          <p className="text-gray-500 font-medium max-w-xl">
            Trips and group plans shared by BoilerBridge travelers. Open a card
            to view the full snapshot (read-only).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-500 whitespace-nowrap">
            Sort
          </span>
          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as "latest" | "popular");
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[160px] rounded-xl border-gray-200">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest</SelectItem>
              <SelectItem value="popular">Most viewed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-500 gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          Loading feed…
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border border-gray-100 shadow-sm">
          <p className="text-gray-400 font-bold text-lg">No public itineraries yet.</p>
          <p className="text-gray-500 text-sm mt-2 max-w-md mx-auto">
            Publish from <strong>All Trips</strong> or your group&apos;s{" "}
            <strong>Timeline</strong> when you&apos;re ready to share.
          </p>
        </div>
      ) : (
        <>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
            {total} result{total === 1 ? "" : "s"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {items.map((it) => (
              <Link
                key={it.publicItineraryId}
                href={`/dashboard/public-itineraries/${it.publicItineraryId}`}
                className="block group"
              >
                <Card className="h-full rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl hover:border-amber-200 transition-all">
                  <CardContent className="p-8 flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight group-hover:text-amber-700 transition-colors">
                          {it.title}
                        </h2>
                        {it.subtitle ? (
                          <div className="mt-1 text-sm font-bold text-gray-400 flex items-center gap-1.5">
                            <Calendar size={14} />
                            {it.subtitle}
                          </div>
                        ) : null}
                      </div>
                      <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700">
                        {it.sourceType === "group" ? "Group" : "Trip"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-gray-500">
                      <span>@{it.ownerUsername}</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye size={16} className="text-gray-400" />
                        {it.views} views
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="flex justify-center gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              disabled={!hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

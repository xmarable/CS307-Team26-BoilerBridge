"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, MapPin, Plus, Search, Star, AlertCircle } from "lucide-react";
import {
  ACCESSIBILITY_REQUIREMENT_OPTIONS,
  emptyAccessibilityRequirements,
} from "@/lib/accessibilityRequirements";
import type { AccessibilityRequirements } from "@/lib/itinerary/schemas";
import {
  hasAnyAccessibilityRequirement,
  matchesAccessibilityRequirements,
} from "@/lib/travel/accessibility";

interface BrowseActivity {
  _id: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount: number;
  wheelchairAccessible?: boolean;
  stepFree?: boolean;
  accessibleRestroom?: boolean;
  hearingAssistance?: boolean;
  visualAssistance?: boolean;
}

type SearchRow = {
  source: "saved" | "google";
  activityId?: string;
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  primaryType?: string;
  accessibility?: {
    wheelchairAccessible?: boolean;
    stepFree?: boolean;
    accessibleRestroom?: boolean;
    hearingAssistance?: boolean;
    visualAssistance?: boolean;
  };
  accessibilityMatch?: boolean;
};

const DEBOUNCE_MS = 320;

export default function ActivitiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [browseActivities, setBrowseActivities] = useState<BrowseActivity[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchRow[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [googlePartial, setGooglePartial] = useState(false);
  const [accessibilityRequirements, setAccessibilityRequirements] =
    useState<AccessibilityRequirements>(emptyAccessibilityRequirements());
  const [hideNonMatching, setHideNonMatching] = useState(true);

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
      .then((data) => setBrowseActivities(data.activities ?? []))
      .catch(() => setBrowseError("Failed to load activities."))
      .finally(() => setBrowseLoading(false));
  }, [status, router]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const runSearch = useCallback(async (q: string, reqs: AccessibilityRequirements) => {
    if (q.length < 2) {
      setSearchResults(null);
      setSearchError(null);
      setGooglePartial(false);
      return;
    }
    setSearchLoading(true);
    setSearchError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("q", q);
      for (const option of ACCESSIBILITY_REQUIREMENT_OPTIONS) {
        if (reqs[option.key]) qs.set(option.key, "true");
      }
      const res = await fetch(
        `/api/activities/search?${qs.toString()}`,
        { credentials: "include" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSearchResults([]);
        setSearchError(typeof data?.error === "string" ? data.error : "Search failed.");
        setGooglePartial(false);
        return;
      }
      setSearchResults(Array.isArray(data.results) ? data.results : []);
      setGooglePartial(Boolean(data.googlePartial));
    } catch {
      setSearchResults([]);
      setSearchError("Could not search. Check your connection and try again.");
      setGooglePartial(false);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      setSearchError(null);
      setGooglePartial(false);
      return;
    }
    runSearch(debouncedQuery, accessibilityRequirements);
  }, [debouncedQuery, runSearch, accessibilityRequirements]);

  const searchActive = debouncedQuery.length >= 2;
  const hasAccessibilityFilters = hasAnyAccessibilityRequirement(
    accessibilityRequirements,
  );
  const filteredSearchResults =
    !searchResults || !hideNonMatching || !hasAccessibilityFilters
      ? searchResults
      : searchResults.filter((row) =>
          matchesAccessibilityRequirements(row.accessibility, accessibilityRequirements),
        );
  const filteredBrowseActivities =
    !hideNonMatching || !hasAccessibilityFilters
      ? browseActivities
      : browseActivities.filter((row) =>
          matchesAccessibilityRequirements(row, accessibilityRequirements),
        );

  const hrefForRow = (row: SearchRow) => {
    if (row.source === "saved" && row.activityId) {
      return `/dashboard/activities/${row.activityId}`;
    }
    const p = new URLSearchParams();
    p.set("placeId", row.placeId);
    p.set("name", row.name);
    if (row.address) p.set("address", row.address);
    return `/dashboard/activities/preview?${p.toString()}`;
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
      <main className="max-w-2xl mx-auto p-4 md:p-8 pb-16">
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-1 -ml-2">
              <ChevronLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
          <Link href="/dashboard/activities/new">
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Activity
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Browse Activities</h1>
        <p className="text-gray-600 mb-6 text-sm md:text-base">
          Discover community picks and places on Google—search below, or scroll the full list when
          the bar is empty.
        </p>

        <div className="relative mb-6">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search BoilerBridge + Google Places…"
            aria-label="Search activities and places"
            className="pl-10 h-11 rounded-xl border-gray-200 bg-white shadow-sm text-gray-900 placeholder:text-gray-400 focus-visible:ring-amber-500/30 focus-visible:border-amber-500"
          />
          {query && (
            <p className="text-xs text-gray-500 mt-2 px-0.5">
              {searchActive
                ? "Showing merged results. Saved community entries are labeled."
                : "Type at least 2 characters to search Google and local activities."}
            </p>
          )}
        </div>

        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50/70 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-gray-800">
              Accessibility filters
            </p>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={hideNonMatching}
                onChange={(e) => setHideNonMatching(e.target.checked)}
                className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
              />
              Hide non-matching results
            </label>
          </div>
          <p className="text-xs text-gray-600">
            Strict mode: places with unknown accessibility data are treated as non-matching.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ACCESSIBILITY_REQUIREMENT_OPTIONS.map((option) => (
              <label
                key={option.key}
                className="flex items-start gap-2 rounded-md border border-sky-100 bg-white px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={Boolean(accessibilityRequirements[option.key])}
                  onChange={(e) =>
                    setAccessibilityRequirements((prev) => ({
                      ...prev,
                      [option.key]: e.target.checked,
                    }))
                  }
                  className="mt-0.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs text-gray-700">
                  <span className="block font-semibold">{option.label}</span>
                  <span className="text-gray-500">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {browseError && (
          <p className="text-red-600 text-sm mb-4" role="alert">
            {browseError}
          </p>
        )}

        {searchActive && searchError && (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 flex gap-3 mb-6"
            role="alert"
          >
            <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-800">{searchError}</p>
          </div>
        )}

        {searchActive && googlePartial && !searchError && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4">
            Some map results were unavailable; local matches are still shown.
          </p>
        )}

        {searchActive ? (
          <section aria-label="Search results" className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Results for &ldquo;{debouncedQuery}&rdquo;
            </h2>
            {searchLoading && (
              <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-[4.5rem] w-full rounded-xl" />
                <Skeleton className="h-[4.5rem] w-full rounded-xl" />
                <Skeleton className="h-[4.5rem] w-full rounded-xl" />
              </div>
            )}
            {!searchLoading &&
              filteredSearchResults &&
              filteredSearchResults.length === 0 &&
              !searchError && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-600 text-sm">
                  No venues match your query and accessibility filters. Try relaxing filters or{" "}
                  <Link
                    href="/dashboard/activities/new"
                    className="text-amber-700 font-medium underline underline-offset-2"
                  >
                    add a new activity
                  </Link>{" "}
                  for the community.
                </div>
              )}
            {!searchLoading && filteredSearchResults && filteredSearchResults.length > 0 && (
              <ul className="space-y-2">
                {filteredSearchResults.map((row) => (
                  <li key={`${row.source}-${row.activityId ?? row.placeId}`}>
                    <Link href={hrefForRow(row)}>
                      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-400 hover:shadow-md transition-all text-left w-full">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-gray-900">{row.name}</p>
                              <Badge
                                variant="secondary"
                                className={
                                  row.source === "saved"
                                    ? "bg-amber-100 text-amber-950 border-amber-200 text-[10px] uppercase tracking-wide"
                                    : "bg-slate-100 text-slate-800 border-slate-200 text-[10px] uppercase tracking-wide"
                                }
                              >
                                {row.source === "saved"
                                  ? "In BoilerBridge"
                                  : "Google Places"}
                              </Badge>
                              {row.primaryType ? (
                                <span className="text-[11px] text-gray-500 font-medium">
                                  {row.primaryType}
                                </span>
                              ) : null}
                            </div>
                            {row.address ? (
                              <p className="text-sm text-gray-500 flex items-start gap-1.5">
                                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{row.address}</span>
                              </p>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                              {row.accessibility?.wheelchairAccessible ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Wheelchair
                                </Badge>
                              ) : null}
                              {row.accessibility?.accessibleRestroom ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Restroom
                                </Badge>
                              ) : null}
                              {typeof row.rating === "number" ? (
                                <span className="inline-flex items-center gap-0.5 font-medium text-gray-800">
                                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                  {row.rating.toFixed(1)}
                                </span>
                              ) : null}
                              {row.reviewCount != null && row.reviewCount > 0 ? (
                                <span className="text-gray-500">
                                  {row.reviewCount.toLocaleString()} reviews
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span className="text-amber-600 text-sm font-semibold shrink-0">
                            View
                          </span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : (
          <>
            {browseLoading && <p className="text-gray-500 text-sm">Loading activities…</p>}
            {!browseLoading && filteredBrowseActivities.length === 0 && !browseError && (
              <p className="text-gray-500">
                No venues match your selected accessibility requirements right now.
              </p>
            )}
            {!browseLoading && filteredBrowseActivities.length > 0 && (
              <section aria-label="All community activities">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Community activities
                </h2>
                <ul className="space-y-3">
                  {filteredBrowseActivities.map((a) => (
                    <li key={a._id}>
                      <Link href={`/dashboard/activities/${a._id}`}>
                        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-amber-300 hover:shadow-sm transition-all">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-gray-900">{a.name}</p>
                                <Badge
                                  variant="secondary"
                                  className="bg-amber-100 text-amber-950 border-amber-200 text-[10px] uppercase tracking-wide"
                                >
                                  In BoilerBridge
                                </Badge>
                              </div>
                              {a.address && (
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  {a.address}
                                </p>
                              )}
                              <div className="mt-1 flex flex-wrap gap-1">
                                {a.wheelchairAccessible ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    Wheelchair
                                  </Badge>
                                ) : null}
                                {a.accessibleRestroom ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    Restroom
                                  </Badge>
                                ) : null}
                              </div>
                              {a.reviewCount > 0 && (
                                <p className="text-xs text-amber-600 mt-1">
                                  {a.reviewCount} review{a.reviewCount !== 1 ? "s" : ""}
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
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

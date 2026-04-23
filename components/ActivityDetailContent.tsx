"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, Link2, MapPin, Star, AlertCircle, Sparkles } from "lucide-react";
import { ActivityBookingSection } from "@/components/ActivityBookingSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingPlan } from "@/lib/travel/bookingIntel";


export interface ActivityDetailPayload {
  activityId?: string;
  isPreview?: boolean;
  name: string;
  address?: string;
  placeId?: string;
  rating: number | null;
  reviewCount: number;
  estimatedCost?: number;
  infoUrl?: string;
  description?: string;
  shortSummary?: string;
  referenceLinks: { title: string; url: string }[];
  bookingUrl?: string;
  expediaSource?: "manual" | "rapid-property" | "hotel-search-fallback";
  types?: string[];
  priceLevel?: number;
  priceLevelLabel?: string;
  phoneNumber?: string;
  openingHours?: string[];
  hintTags?: string[];
  bookingPlan?: BookingPlan;
  budgetNote?: string;
  heroImageUrl?: string;
  googlePlace?: {
    placeId: string;
    displayName?: string;
    rating?: number;
    userRatingCount?: number;
    reviews: { text: string; rating: number; author?: string }[];
    googleMapsUri?: string;
    types?: string[];
    priceLevel?: number;
    nationalPhoneNumber?: string;
    weekdayDescriptions?: string[];
  };
}

export type ActivityDetailContentProps =
  | { activityId: string }
  | {
      /** When set, loads Google + booking detail for that place (US15). */
      previewPlaceId?: string;
      /** Required for name-only preview; also sent with placeId as display hint. */
      previewName?: string;
      previewAddress?: string;
      /** Trip destination / metro — biases text search away from wrong-city chain hits */
      previewDestinationCity?: string;
    };

function formatPlaceType(t: string): string {
  return t
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ActivityDetailContent(props: ActivityDetailContentProps) {
  const [data, setData] = useState<ActivityDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activityId = "activityId" in props ? props.activityId : undefined;
  const previewPlaceId =
    "activityId" in props ? undefined : props.previewPlaceId?.trim() || undefined;
  const previewName =
    "activityId" in props ? undefined : props.previewName?.trim() || undefined;
  const previewAddress =
    "activityId" in props ? undefined : props.previewAddress?.trim() || undefined;
  const previewDestinationCity =
    "activityId" in props ? undefined : props.previewDestinationCity?.trim() || undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    let url: string | null = null;
    if (activityId) {
      url = `/api/activities/${activityId}`;
    } else if (previewPlaceId || (previewName && previewName.length >= 2)) {
      const p = new URLSearchParams();
      if (previewPlaceId) p.set("placeId", previewPlaceId);
      p.set("name", previewName && previewName.length >= 2 ? previewName : "Place");
      if (previewAddress) p.set("address", previewAddress);
      if (previewDestinationCity) p.set("destination", previewDestinationCity);
      url = `/api/activities/preview?${p.toString()}`;
    }

    if (!url) {
      setLoading(false);
      setError("Nothing to load.");
      return;
    }

    fetch(url, { credentials: "include" })
      .then(async (res) => {
        if (res.status === 404) {
          setError("This activity could not be found.");
          setData(null);
          return;
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setError(typeof j?.error === "string" ? j.error : "Could not load activity.");
          setData(null);
          return;
        }
        return res.json();
      })
      .then((payload: { activity?: ActivityDetailPayload } | undefined) => {
        if (cancelled || !payload?.activity) return;
        setData(payload.activity);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Something went wrong while loading this activity.");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activityId, previewPlaceId, previewName, previewAddress, previewDestinationCity]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading activity details">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-9 w-3/4 max-w-lg" />
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 flex gap-3"
        role="alert"
      >
        <AlertCircle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-gray-900">Activity details unavailable</p>
          <p className="text-sm text-gray-600 mt-1">{error ?? "No data returned."}</p>
        </div>
      </div>
    );
  }

  const categoryTypes = (data.types ?? [])
    .filter((t) => !t.startsWith("establishment") && t !== "point_of_interest")
    .slice(0, 6);

  const addToCommunityHref = `/dashboard/activities/new?name=${encodeURIComponent(data.name)}${data.address ? `&address=${encodeURIComponent(data.address)}` : ""}`;

  return (
    <div className="space-y-8">
      {data.isPreview ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p className="text-sm text-gray-800 leading-snug">
            <span className="font-semibold text-amber-900">Preview.</span> This place is not in
            BoilerBridge yet. You can read full details below without saving—add it anytime to
            share with the community.
          </p>
          <Button
            className="shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
            size="sm"
            asChild
          >
            <Link href={addToCommunityHref}>Add to BoilerBridge</Link>
          </Button>
        </div>
      ) : null}

      {data.heroImageUrl ? (
        <div className="relative w-full aspect-[2/1] max-h-64 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
          <Image
            src={data.heroImageUrl}
            alt={data.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 42rem"
            unoptimized
            priority
          />
        </div>
      ) : null}

      <header className="space-y-3">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
          {data.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          {typeof data.rating === "number" ? (
            <span className="inline-flex items-center gap-1 font-medium text-gray-800">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" aria-hidden />
              {data.rating.toFixed(1)}
              <span className="text-gray-500 font-normal">
                ({data.reviewCount.toLocaleString()} reviews)
              </span>
            </span>
          ) : (
            <span className="text-gray-500">No rating yet</span>
          )}
          {data.priceLevelLabel ? (
            <>
              <span className="text-gray-300" aria-hidden>
                ·
              </span>
              <span className="font-medium text-gray-800">{data.priceLevelLabel}</span>
            </>
          ) : null}
        </div>

        {(data.hintTags?.length ?? 0) > 0 ? (
          <div className="flex flex-wrap gap-2 items-center">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
            {data.hintTags!.map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-amber-50 text-amber-900 border-amber-200">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {categoryTypes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {categoryTypes.map((t) => (
              <Badge key={t} variant="outline" className="text-gray-600 font-normal">
                {formatPlaceType(t)}
              </Badge>
            ))}
          </div>
        ) : null}
      </header>

      {data.shortSummary ? (
        <p className="text-base text-gray-700 leading-relaxed border-l-4 border-amber-400 pl-4 py-0.5">
          {data.shortSummary}
        </p>
      ) : null}

      {data.bookingPlan ? <ActivityBookingSection plan={data.bookingPlan} /> : null}

      {data.budgetNote ? (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
          {data.budgetNote}
        </p>
      ) : null}

      <div className="grid gap-6 md:grid-cols-1">
        {data.address ? (
          <div className="flex items-start gap-3 text-gray-700">
            <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Location
              </p>
              <p className="mt-0.5">{data.address}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No address on file.</p>
        )}

        {data.openingHours && data.openingHours.length > 0 ? (
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Hours
              </p>
              <ul className="mt-1 text-sm text-gray-700 space-y-0.5">
                {data.openingHours.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {data.phoneNumber ? (
          <p className="text-sm text-gray-700">
            <span className="font-semibold text-gray-500">Phone · </span>
            <a
              href={`tel:${data.phoneNumber.replace(/[^\d+]/g, "")}`}
              className="text-amber-700 hover:text-amber-900 font-medium underline-offset-2 hover:underline"
            >
              {data.phoneNumber}
            </a>
          </p>
        ) : null}
      </div>

      {data.description ? (
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">About</h2>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{data.description}</p>
        </section>
      ) : !data.shortSummary ? (
        <p className="text-sm text-gray-500 italic">No detailed description yet.</p>
      ) : null}

      {data.infoUrl ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Link2 className="h-4 w-4" aria-hidden />
            Official site
          </h2>
          <Button variant="outline" size="sm" asChild>
            <a href={data.infoUrl} target="_blank" rel="noopener noreferrer">
              Visit website
            </a>
          </Button>
        </div>
      ) : null}

      {data.referenceLinks && data.referenceLinks.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Links</h2>
          <ul className="flex flex-col gap-2">
            {data.referenceLinks.map((link) => (
              <li key={`${link.url}-${link.title}`}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-700 hover:text-amber-900 underline text-sm font-medium"
                >
                  {link.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.googlePlace ? (
        <Card className="border-gray-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Google reviews</CardTitle>
            <p className="text-xs text-gray-500">
              Snippets follow{" "}
              <a
                href="https://developers.google.com/maps/documentation/places/web-service/policies"
                className="text-amber-700 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Maps policies
              </a>
              .
            </p>
            {typeof data.googlePlace.rating === "number" ? (
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {data.googlePlace.rating.toFixed(1)}★
                </span>
                {typeof data.googlePlace.userRatingCount === "number"
                  ? ` · ${data.googlePlace.userRatingCount.toLocaleString()} Google ratings`
                  : null}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            {data.googlePlace.reviews.length > 0 ? (
              <ul className="space-y-4">
                {data.googlePlace.reviews.map((rev, idx) => (
                  <li
                    key={`${idx}-${rev.author ?? "a"}`}
                    className="text-sm border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
                  >
                    <div className="flex items-center gap-2 text-gray-600 mb-1">
                      <span className="font-medium text-gray-800">
                        {rev.author ?? "Google user"}
                      </span>
                      <span>{rev.rating.toFixed(0)}★</span>
                    </div>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {rev.text}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">
                No review text returned for this place (ratings may still apply).
              </p>
            )}
            {data.googlePlace.googleMapsUri ? (
              <Button variant="outline" size="sm" asChild>
                <a
                  href={data.googlePlace.googleMapsUri}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Google Maps
                </a>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

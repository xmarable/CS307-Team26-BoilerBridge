"use client";

import { useEffect, useState } from "react";
import { MapPin, Link2, AlertCircle } from "lucide-react";
import { ActivityBookingButton } from "@/components/ActivityBookingButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface ActivityDetailPayload {
  _id: string;
  name: string;
  address?: string;
  placeId?: string;
  rating: number | null;
  reviewCount: number;
  estimatedCost?: number;
  infoUrl?: string;
  description?: string;
  referenceLinks: { title: string; url: string }[];
  bookingUrl?: string;
}

interface ActivityDetailContentProps {
  activityId: string;
}

export function ActivityDetailContent({ activityId }: ActivityDetailContentProps) {
  const [data, setData] = useState<ActivityDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activityId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/activities/${activityId}`, { credentials: "include" })
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
  }, [activityId]);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading activity details">
        <Skeleton className="h-9 w-3/4 max-w-lg" />
        <Skeleton className="h-8 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-24 w-full rounded-xl" />
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
          <p className="text-xs text-gray-500 mt-2">
            You can still read reviews below if this activity exists in our system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Activity information
          {typeof data.rating === "number" && (
            <>
              {" "}
              · {data.rating.toFixed(1)}★ ({data.reviewCount} reviews)
            </>
          )}
        </p>
      </header>

      {data.address ? (
        <div className="flex items-start gap-2 text-gray-700">
          <MapPin className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-500">Location</p>
            <p>{data.address}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">No address on file.</p>
      )}

      {data.description ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">About</h2>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{data.description}</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 italic">No detailed description yet.</p>
      )}

      {data.infoUrl ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Official / info
          </h2>
          <Button variant="outline" size="sm" asChild>
            <a href={data.infoUrl} target="_blank" rel="noopener noreferrer">
              Open information link
            </a>
          </Button>
        </div>
      ) : null}

      {data.referenceLinks && data.referenceLinks.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-2">More resources</h2>
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

      {!data.description && !data.infoUrl && !(data.referenceLinks?.length) ? (
        <p className="text-sm text-gray-500">
          More information will appear here when it is added for this activity.
        </p>
      ) : null}

      <div className="pt-2 flex flex-wrap items-center gap-3">
        <ActivityBookingButton bookingUrl={data.bookingUrl} />
        {data.estimatedCost != null && (
          <span className="text-sm text-gray-600">
            Est. cost: <strong>${data.estimatedCost}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

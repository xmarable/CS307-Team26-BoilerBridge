"use client";

import { useEffect, useState } from "react";
import {
  Star,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";
import { Button } from "./ui/button";

interface SummaryData {
  averageRating: number;
  sentimentSummary: string;
  highlights: string[];
  pros: string[];
  cons: string[];
  bookingUrl?: string; // added for external booking support
  activityName?: string; // added to help with fallback links
}

interface ActivitySummaryCardProps {
  activityId: string;
  className?: string;
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={`${rating} out of ${max} stars`}
    >
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-5 w-5",
            i < full
              ? "fill-amber-500 text-amber-500"
              : i === full && hasHalf
                ? "fill-amber-500/50 text-amber-500"
                : "text-bb-text-muted",
          )}
        />
      ))}
    </div>
  );
}

export function ActivitySummaryCard({
  activityId,
  className,
}: ActivitySummaryCardProps) {
  const [summary, setSummary] = useState<SummaryData | null | undefined>(
    undefined,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activityId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/activities/${activityId}/review-summary`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.summary) {
          setSummary(data.summary);
          setMessage(null);
        } else {
          setSummary(null);
          setMessage(data?.message ?? "No summary available.");
        }
      })
      .catch(() => {
        setSummary(null);
        setMessage("Could not load summary.");
      })
      .finally(() => setLoading(false));
  }, [activityId]);

  /**
   * logic for handling external booking redirects.
   * uses the bookingUrl from the DB if it exists, otherwise falls back to a google search.
   */
  const handleBookingClick = () => {
    if (summary?.bookingUrl) {
      window.open(summary.bookingUrl, "_blank", "noopener,noreferrer");
    } else {
      const query = encodeURIComponent(
        `${summary?.activityName || "activity"} near West Lafayette booking`,
      );
      window.open(
        `https://www.google.com/search?q=${query}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || message) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="py-6">
          <div className="flex flex-col items-center gap-2 text-bb-text-muted">
            <Sparkles className="h-8 w-8 text-bb-text-muted" />
            <p className="text-center text-sm">
              {message ??
                "No summary available yet. Add reviews to see a summary."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <StarRating rating={summary.averageRating} />
            <span className="text-lg font-bold text-bb-text">
              {summary.averageRating.toFixed(1)}
            </span>
          </div>
          {/* external booking trigger button */}
          <Button
            onClick={handleBookingClick}
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
          >
            <ExternalLink size={14} />
            Book Now
          </Button>
        </div>
        <CardTitle className="text-base font-medium text-bb-text-sub">
          Review Summary
        </CardTitle>
        <p className="text-sm text-bb-text-muted">{summary.sentimentSummary}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.highlights.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-bb-text-muted uppercase tracking-wide mb-2">
              Quick insights
            </p>
            <ul className="space-y-1">
              {summary.highlights.map((h, i) => (
                <li
                  key={i}
                  className="text-sm text-bb-text-sub pl-4 border-l-2 border-amber-200"
                >
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}
        {summary.pros.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ThumbsUp className="h-3.5 w-3.5" />
              Pros
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.pros.map((p, i) => (
                <span
                  key={i}
                  className="text-xs bg-green-50 text-green-800 px-2 py-1 rounded-md"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
        {summary.cons.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ThumbsDown className="h-3.5 w-3.5" />
              Cons
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.cons.map((c, i) => (
                <span
                  key={i}
                  className="text-xs bg-amber-50 text-amber-800 px-2 py-1 rounded-md"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Star, ThumbsUp, ThumbsDown, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";

interface SummaryData {
  averageRating: number;
  sentimentSummary: string;
  highlights: string[];
  pros: string[];
  cons: string[];
}

interface ActivitySummaryCardProps {
  activityId: string;
  className?: string;
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn(
            "h-5 w-5",
            i < full
              ? "fill-amber-500 text-amber-500"
              : i === full && hasHalf
                ? "fill-amber-500/50 text-amber-500"
                : "text-gray-200"
          )}
        />
      ))}
    </div>
  );
}

export function ActivitySummaryCard({ activityId, className }: ActivitySummaryCardProps) {
  const [summary, setSummary] = useState<SummaryData | null | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activityId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/activities/${activityId}/review-summary`, { credentials: "include" })
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
          <div className="flex flex-col items-center gap-2 text-gray-500">
            <Sparkles className="h-8 w-8 text-gray-300" />
            <p className="text-center text-sm">
              {message ?? "No summary available yet. Add reviews to see a summary."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3 mb-2">
          <StarRating rating={summary.averageRating} />
          <span className="text-lg font-bold text-gray-900">
            {summary.averageRating.toFixed(1)}
          </span>
        </div>
        <CardTitle className="text-base font-medium text-gray-700">
          Review Summary
        </CardTitle>
        <p className="text-sm text-gray-600">{summary.sentimentSummary}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.highlights.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Quick insights
            </p>
            <ul className="space-y-1">
              {summary.highlights.map((h, i) => (
                <li key={i} className="text-sm text-gray-700 pl-4 border-l-2 border-amber-200">
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

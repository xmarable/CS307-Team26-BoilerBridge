"use client";

import { useEffect, useState, useCallback } from "react";
import { Star, MessageSquare, PenLine } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/utils";

interface Review {
  author: string;
  text: string;
  rating: number;
  time: string;
}

interface ReviewsResponse {
  reviews: Review[];
  rating: number | null;
  reviewCount: number;
  name?: string;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  } catch {
    return "";
  }
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
            "h-4 w-4",
            i < full
              ? "fill-amber-500 text-amber-500"
              : i === full && hasHalf
                ? "fill-amber-500/50 text-amber-500"
                : "text-gray-200",
          )}
        />
      ))}
    </div>
  );
}

interface ActivityReviewsProps {
  activityId: string;
  className?: string;
  /** When set, show "Write a review" form using this name as author */
  currentUserDisplayName?: string | null;
}

function fetchReviews(activityId: string): Promise<ReviewsResponse> {
  return fetch(`/api/activities/${activityId}/reviews`, {
    credentials: "include",
  }).then((res) => {
    if (!res.ok) {
      return res.json().then((body) => {
        throw new Error(
          body?.error ?? `Failed to load reviews (${res.status})`,
        );
      });
    }
    return res.json();
  });
}

export function ActivityReviews({
  activityId,
  className,
  currentUserDisplayName,
}: ActivityReviewsProps) {
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [writeRating, setWriteRating] = useState(0);
  const [writeText, setWriteText] = useState("");

  const loadReviews = useCallback(() => {
    if (!activityId) return;
    setLoading(true);
    setError(null);
    fetchReviews(activityId)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [activityId]);

  useEffect(() => {
    if (!activityId) {
      setError("Invalid activity");
      setLoading(false);
      return;
    }
    loadReviews();
  }, [activityId, loadReviews]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityId || writeRating < 1 || writeRating > 5 || !writeText.trim())
      return;
    setSubmitError(null);
    setSubmitting(true);
    fetch(`/api/activities/${activityId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ text: writeText.trim(), rating: writeRating }),
    })
      .then((res) => {
        if (!res.ok)
          return res.json().then((body: { error?: string }) => {
            throw new Error(body?.error ?? "Failed to submit");
          });
        return res.json();
      })
      .then(() => {
        setWriteText("");
        setWriteRating(0);
        loadReviews();
      })
      .catch((err: Error) => setSubmitError(err.message))
      .finally(() => setSubmitting(false));
  };

  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="py-8">
          <p className="text-center text-red-600" role="alert">
            {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  const reviews = data?.reviews ?? [];
  const rating = data?.rating ?? null;
  const reviewCount = data?.reviewCount ?? 0;

  const WriteReviewForm = currentUserDisplayName ? (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <PenLine className="h-4 w-4" />
          Write a review
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmitReview} className="space-y-4">
          <div>
            <Label className="text-sm">Your rating</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setWriteRating(r)}
                  className="p-1 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                  aria-label={`${r} stars`}
                >
                  <Star
                    className={cn(
                      "h-8 w-8 transition-colors",
                      r <= writeRating
                        ? "fill-amber-500 text-amber-500"
                        : "text-gray-200",
                    )}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="review-text" className="text-sm">
              Your review
            </Label>
            <Textarea
              id="review-text"
              value={writeText}
              onChange={(e) => setWriteText(e.target.value)}
              placeholder="Share your experience..."
              rows={4}
              maxLength={2000}
              className="mt-1 resize-none"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              {writeText.length}/2000
            </p>
          </div>
          {submitError && <p className="text-sm text-red-600">{submitError}</p>}
          <Button
            type="submit"
            disabled={submitting || writeRating < 1 || !writeText.trim()}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {submitting ? "Submitting…" : "Submit review"}
          </Button>
        </form>
      </CardContent>
    </Card>
  ) : null;

  if (reviews.length === 0) {
    return (
      <>
        {WriteReviewForm}
        <Card className={cn("overflow-hidden", className)}>
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
              <MessageSquare className="h-10 w-10 text-gray-300" />
              <p className="text-center">No reviews yet for this place.</p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      {WriteReviewForm}
      <Card className={cn("overflow-hidden", className)}>
        <CardHeader className="border-b">
          <div className="flex items-center gap-3">
            {rating != null && (
              <div className="flex items-center gap-2">
                <StarRating rating={rating} />
                <span className="text-sm font-medium text-gray-700">
                  {rating.toFixed(1)}
                </span>
              </div>
            )}
            <span className="text-sm text-gray-500">
              {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
            </span>
          </div>
          <CardTitle className="sr-only">Reviews</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-80 px-6">
            <div className="space-y-4 py-4 pr-4">
              {reviews.map((review, index) => (
                <div
                  key={index}
                  className="border-b border-gray-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {review.author}
                    </span>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-gray-500">
                        {formatRelativeTime(review.time)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{review.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  );
}

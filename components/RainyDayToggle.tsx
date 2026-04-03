"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudRain, Sun, Columns, ChevronRight } from "lucide-react";
import { isValidActivityMongoId } from "@/lib/activityObjectId";

function ItineraryCard({
  act,
  className,
  subtitle,
  subtitleClassName,
}: {
  act: { name: string; isOutdoor?: boolean; activityId?: string };
  className?: string;
  /** Overrides the default Outdoor/Indoor line (e.g. rainy-day label) */
  subtitle?: string;
  subtitleClassName?: string;
}) {
  const detailHref = isValidActivityMongoId(act.activityId)
    ? `/dashboard/activities/${act.activityId}`
    : null;

  const subline =
    subtitle ?? (act.isOutdoor ? "Outdoor" : "Indoor");

  const body = (
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">{act.name}</p>
          <p
            className={`text-xs ${subtitleClassName ?? "text-gray-500"}`}
          >
            {subline}
          </p>
        </div>
        {detailHref && (
          <ChevronRight className="h-4 w-4 text-amber-600 shrink-0 mt-1" aria-hidden />
        )}
      </div>
      {detailHref && (
        <p className="text-xs text-amber-700 mt-2 font-medium">View details</p>
      )}
    </CardContent>
  );

  if (detailHref) {
    return (
      <Link href={detailHref} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
        <Card className={`transition-shadow hover:shadow-md cursor-pointer ${className ?? ""}`}>
          {body}
        </Card>
      </Link>
    );
  }

  return <Card className={className}>{body}</Card>;
}

export function RainyDayToggle({ trip }: { trip: any }) {
  const [viewMode, setViewMode] = useState<"primary" | "rainy" | "compare">(
    "primary",
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-center p-4 bg-gray-50 rounded-lg">
        <Button
          variant={viewMode === "primary" ? "default" : "outline"}
          onClick={() => setViewMode("primary")}
        >
          <Sun className="mr-2 h-4 w-4" /> Primary
        </Button>
        <Button
          variant={viewMode === "rainy" ? "default" : "outline"}
          onClick={() => setViewMode("rainy")}
        >
          <CloudRain className="mr-2 h-4 w-4" /> Rainy Day
        </Button>
        <Button
          variant={viewMode === "compare" ? "default" : "outline"}
          onClick={() => setViewMode("compare")}
        >
          <Columns className="mr-2 h-4 w-4" /> Compare
        </Button>
      </div>

      <div
        className={`grid gap-4 ${viewMode === "compare" ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {(viewMode === "primary" || viewMode === "compare") && (
          <div className="space-y-2">
            <h3 className="font-bold text-center">Primary Plan</h3>
            {trip.primaryItinerary.map((act: any, i: number) => (
              <ItineraryCard
                key={i}
                act={act}
                className={act.isOutdoor ? "border-amber-200" : ""}
              />
            ))}
          </div>
        )}

        {(viewMode === "rainy" || viewMode === "compare") && (
          <div className="space-y-2">
            <h3 className="font-bold text-center text-blue-600">
              Rainy Day Plan
            </h3>
            {trip.rainyDayItinerary.map((act: any, i: number) => (
              <ItineraryCard
                key={i}
                act={act}
                subtitle="Indoor Alternative"
                subtitleClassName="text-blue-600"
                className="border-blue-200 bg-blue-50/30"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CloudRain, Sun, Columns } from "lucide-react";

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
              <Card key={i} className={act.isOutdoor ? "border-amber-200" : ""}>
                <CardContent className="p-4">
                  <p className="font-medium">{act.name}</p>
                  <p className="text-xs text-gray-500">
                    {act.isOutdoor ? "Outdoor" : "Indoor"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {(viewMode === "rainy" || viewMode === "compare") && (
          <div className="space-y-2">
            <h3 className="font-bold text-center text-blue-600">
              Rainy Day Plan
            </h3>
            {trip.rainyDayItinerary.map((act: any, i: number) => (
              <Card key={i} className="border-blue-200 bg-blue-50/30">
                <CardContent className="p-4">
                  <p className="font-medium">{act.name}</p>
                  <p className="text-xs text-blue-500">Indoor Alternative</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { WifiOff, Database } from "lucide-react";

type Props = {
  isOffline: boolean;
  isShowingCached: boolean;
};

export function OfflineItineraryBanner({ isOffline, isShowingCached }: Props) {
  if (!isOffline && !isShowingCached) return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900"
    >
      {isOffline ? (
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <Database className="h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>
        {isOffline && isShowingCached
          ? "You’re offline — showing a saved copy of this itinerary."
          : isOffline
            ? "You’re offline. Connect to load the latest from the server."
            : "Showing a saved copy (couldn’t load the latest from the server)."}
      </span>
    </div>
  );
}

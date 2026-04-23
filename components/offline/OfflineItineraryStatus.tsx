"use client";

import { formatDistanceToNow } from "date-fns";
import { Database, Download, Info, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type TripPlanError = "offline_unavailable" | "auth" | "other" | null;

type Props = {
  isOnline: boolean;
  isShowingCached: boolean;
  tripPlanError: TripPlanError;
  hasTripContent: boolean;
  isLoading: boolean;
  lastDeviceSavedAt: number | null;
  idbSupported: boolean;
  onSaveOrRefresh: () => void;
  onRemoveLocal: () => void;
  isSaveBusy: boolean;
};

/**
 * Surfaces how offline itinerary caching works: automatic save, last sync, refresh,
 * and what happens when the network or server is unavailable.
 */
export function OfflineItineraryStatus({
  isOnline,
  isShowingCached,
  tripPlanError,
  hasTripContent,
  isLoading,
  lastDeviceSavedAt,
  idbSupported,
  onSaveOrRefresh,
  onRemoveLocal,
  isSaveBusy,
}: Props) {
  const whenSavedText =
    lastDeviceSavedAt != null
      ? `Last saved to this device ${formatDistanceToNow(lastDeviceSavedAt, { addSuffix: true })}.`
      : null;

  const showStaleOrOfflineBar = (!isOnline || isShowingCached) && hasTripContent;
  const showOnlineHealthyStrip =
    isOnline && !isShowingCached && hasTripContent && idbSupported;
  const showNoIdb = hasTripContent && !idbSupported && isOnline;
  const showEmptyOfflineHelp = tripPlanError === "offline_unavailable";
  const showOfflineNoDataBar = !isOnline && !hasTripContent && !isLoading;

  return (
    <div className="space-y-3" aria-label="Offline trip plan status">
      {showOfflineNoDataBar && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-900"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
          <span>You’re offline. Reconnect to load your trip and save a copy for the next time you have no signal.</span>
        </div>
      )}
      {showStaleOrOfflineBar && hasTripContent && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            {isOnline ? (
              <Database className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            ) : (
              <WifiOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            )}
            <div>
              <p>
                {isOnline && isShowingCached
                  ? "We couldn’t load the latest version from the server, so you’re seeing a copy saved in this browser."
                  : isOnline
                    ? "Showing a saved copy in this browser."
                    : isShowingCached
                      ? "You’re offline. Showing the itinerary we saved in this browser for this group."
                      : "You’re offline. Connect to load the latest from the server."}
              </p>
              {whenSavedText && (
                <p className="text-xs text-amber-800/90 font-semibold mt-1.5">
                  {whenSavedText}
                </p>
              )}
            </div>
          </div>
          {hasTripContent && idbSupported && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {isOnline && (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="rounded-xl bg-amber-700 text-white hover:bg-amber-800"
                  onClick={onSaveOrRefresh}
                  disabled={isSaveBusy}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1.5 ${isSaveBusy ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                  Update from server
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl border-amber-300 text-amber-900"
                onClick={onRemoveLocal}
                disabled={isSaveBusy}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
                Remove offline copy
              </Button>
            </div>
          )}
        </div>
      )}

      {showOnlineHealthyStrip && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-950">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" aria-hidden />
            <div className="space-y-1.5 min-w-0 flex-1">
              <p className="font-bold text-emerald-900">Travel without Wi‑Fi</p>
              <p className="text-emerald-800/90 leading-snug">
                When you open this trip plan <span className="font-semibold">while online</span>, BoilerBridge
                keeps a copy in this browser. Use it in airports, trains, or anywhere the signal
                is weak. Edits you make while online update this saved copy and sync to your group
                when the connection is good.
              </p>
              {whenSavedText && (
                <p className="text-xs font-semibold text-emerald-800">{whenSavedText}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 pl-0 sm:pl-6">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl border-emerald-300 bg-white/80 text-emerald-900 hover:bg-emerald-100"
              onClick={onSaveOrRefresh}
              disabled={isSaveBusy}
            >
              {isSaveBusy ? (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              )}
              Refresh saved copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="rounded-xl text-emerald-900 hover:bg-emerald-100/80"
              onClick={onRemoveLocal}
              disabled={isSaveBusy}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              Remove from this device
            </Button>
          </div>
        </div>
      )}

      {showNoIdb && (
        <p
          role="status"
          className="text-sm text-bb-text-muted font-medium border border-bb-border rounded-2xl px-4 py-2.5 bg-bb-surface-subtle"
        >
          This browser can’t store an offline itinerary (storage unavailable). The trip plan
          still works when you are online.
        </p>
      )}

      {showEmptyOfflineHelp && (
        <div
          role="region"
          aria-label="How to use this itinerary offline"
          className="rounded-2xl border border-bb-border bg-bb-surface-subtle px-4 py-4 text-left text-sm text-bb-text-muted"
        >
          <p className="font-bold text-bb-text mb-2">To view this plan without internet</p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Connect to the internet (Wi‑Fi or cellular).</li>
            <li>Stay on this <span className="font-semibold">Itinerary</span> tab until the trip plan loads above.</li>
            <li>We save a copy in this browser — then you can go offline and reopen this same group page.</li>
          </ol>
        </div>
      )}
    </div>
  );
}

"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type TripPlanError = "offline_unavailable" | "auth" | "other" | null;

export type ItineraryOfflineControlsProps = {
  isOnline: boolean;
  userHasOfflineSave: boolean;
  savedAt: number | null;
  lastSyncedAt: number | null;
  tripPlanError: TripPlanError;
  hasTripContent: boolean;
  idbSupported: boolean;
  itinerarySyncState: "idle" | "syncing" | "failed";
  offlineActionBusy: boolean;
  tripPlanLoading: boolean;
  onSaveForOffline: () => void;
  onRemoveOffline: () => void;
  onRetrySync: () => void;
};

export function ItineraryOfflineControls({
  isOnline,
  userHasOfflineSave,
  savedAt,
  lastSyncedAt,
  tripPlanError,
  hasTripContent,
  idbSupported,
  itinerarySyncState,
  offlineActionBusy,
  tripPlanLoading,
  onSaveForOffline,
  onRemoveOffline,
  onRetrySync,
}: ItineraryOfflineControlsProps) {
  const showOfflineBanner = !isOnline;
  const showSave =
    isOnline && idbSupported && hasTripContent && !userHasOfflineSave;
  const showSavedStrip =
    isOnline && idbSupported && hasTripContent && userHasOfflineSave;
  const showOfflineNoCopy =
    !isOnline &&
    tripPlanError === "offline_unavailable" &&
    !hasTripContent &&
    !tripPlanLoading;
  const showOfflineNoMapping =
    !isOnline &&
    tripPlanError === null &&
    !hasTripContent &&
    !tripPlanLoading &&
    !userHasOfflineSave;
  const showSyncing =
    itinerarySyncState === "syncing" &&
    (offlineActionBusy || tripPlanLoading);
  const showSyncFailed =
    isOnline && itinerarySyncState === "failed" && hasTripContent;

  const savedLine =
    savedAt != null
      ? `Saved to this device ${formatDistanceToNow(savedAt, { addSuffix: true })}`
      : null;
  const syncedLine =
    lastSyncedAt != null
      ? `Last synced ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}`
      : null;

  return (
    <div
      className="mb-6 space-y-3 rounded-2xl border border-bb-border bg-bb-surface-subtle/60 p-4"
      aria-label="Offline itinerary"
    >
      {showOfflineBanner && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
        >
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
          <span>You’re offline</span>
        </div>
      )}

      {showSyncing && (
        <p className="flex items-center gap-2 text-xs font-semibold text-bb-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
          Syncing…
        </p>
      )}

      {showSyncFailed && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs font-semibold text-amber-950"
        >
          <span className="inline-flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Couldn’t reach the server. Showing your saved offline copy.
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-amber-300 text-amber-950"
            onClick={onRetrySync}
            disabled={tripPlanLoading}
          >
            Retry
          </Button>
        </div>
      )}

      {!idbSupported && hasTripContent && (
        <p className="text-xs font-medium text-bb-text-muted">
          This browser can’t store an offline copy. The itinerary still works while you are
          online.
        </p>
      )}

      {showSave && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-bb-text-muted leading-snug">
            Save a copy on this device to open this itinerary without internet. You can remove
            it anytime.
          </p>
          <Button
            type="button"
            size="sm"
            variant="default"
            className="shrink-0 rounded-xl bg-amber-600 text-white hover:bg-amber-700"
            onClick={onSaveForOffline}
            disabled={offlineActionBusy || tripPlanLoading}
          >
            {offlineActionBusy ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            )}
            Save for Offline
          </Button>
        </div>
      )}

      {showSavedStrip && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2 min-w-0">
            <CheckCircle2
              className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600"
              aria-hidden
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold text-bb-text">Available Offline</p>
              <p className="text-xs font-medium text-bb-text-muted leading-relaxed">
                This copy stays on this device until you remove it or it is replaced when you
                save again after the itinerary changes online.
              </p>
              {(savedLine || syncedLine) && (
                <p className="text-xs font-semibold text-emerald-800/90 pt-0.5">
                  {[savedLine, syncedLine].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 rounded-xl border-bb-border text-bb-text"
            onClick={onRemoveOffline}
            disabled={offlineActionBusy || tripPlanLoading}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Remove Offline Copy
          </Button>
        </div>
      )}

      {!isOnline && userHasOfflineSave && hasTripContent && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold text-bb-text-muted">
            {[savedLine, syncedLine].filter(Boolean).join(" · ")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 rounded-xl border-bb-border text-bb-text"
            onClick={onRemoveOffline}
            disabled={offlineActionBusy}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Remove Offline Copy
          </Button>
        </div>
      )}

      {tripPlanError === "auth" && (
        <p className="text-sm font-medium text-bb-text-muted" role="alert">
          Please sign in again to load this itinerary.
        </p>
      )}

      {showOfflineNoCopy && (
        <p
          className="text-sm font-medium text-bb-text leading-snug"
          role="status"
        >
          This itinerary is not saved for offline viewing. While online, open this group and
          choose Save for Offline, then you can use it without signal.
        </p>
      )}

      {showOfflineNoMapping && (
        <p
          className="text-sm font-medium text-bb-text-muted leading-snug"
          role="status"
        >
          You’re offline. Open this group once while online so it loads in this browser; then use
          Save for Offline on the itinerary you want to keep.
        </p>
      )}
    </div>
  );
}

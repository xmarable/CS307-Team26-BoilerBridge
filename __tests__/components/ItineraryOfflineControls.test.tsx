/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { describe, it, expect, jest } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { ItineraryOfflineControls } from "@/components/offline/ItineraryOfflineControls";

const base = {
  savedAt: null as number | null,
  lastSyncedAt: null as number | null,
  tripPlanError: null as "offline_unavailable" | "auth" | "other" | null,
  idbSupported: true,
  itinerarySyncState: "idle" as const,
  offlineActionBusy: false,
  tripPlanLoading: false,
  onSaveForOffline: () => {},
  onRemoveOffline: () => {},
  onRetrySync: () => {},
};

describe("ItineraryOfflineControls", () => {
  it("shows_save_for_offline_when_online_not_saved_with_trip_content", () => {
    render(
      <ItineraryOfflineControls
        {...base}
        isOnline
        userHasOfflineSave={false}
        hasTripContent
      />,
    );
    expect(screen.getByRole("button", { name: /save for offline/i })).toBeInTheDocument();
  });

  it("shows_available_offline_when_online_and_saved", () => {
    render(
      <ItineraryOfflineControls
        {...base}
        isOnline
        userHasOfflineSave
        hasTripContent
        savedAt={Date.now()}
        lastSyncedAt={Date.now()}
      />,
    );
    expect(screen.getByText(/available offline/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove offline copy/i }),
    ).toBeInTheDocument();
  });

  it("shows_offline_banner_only_when_offline", () => {
    const { rerender } = render(
      <ItineraryOfflineControls
        {...base}
        isOnline={false}
        userHasOfflineSave
        hasTripContent
      />,
    );
    expect(screen.getByText(/you’re offline/i)).toBeInTheDocument();
    rerender(
      <ItineraryOfflineControls
        {...base}
        isOnline
        userHasOfflineSave
        hasTripContent
      />,
    );
    expect(screen.queryByText(/you’re offline/i)).not.toBeInTheDocument();
  });

  it("shows_no_offline_copy_message_when_offline_without_content", () => {
    render(
      <ItineraryOfflineControls
        {...base}
        isOnline={false}
        userHasOfflineSave={false}
        hasTripContent={false}
        tripPlanError="offline_unavailable"
      />,
    );
    expect(
      screen.getByText(/not saved for offline viewing/i),
    ).toBeInTheDocument();
  });

  it("shows_syncing_when_syncing_state", () => {
    render(
      <ItineraryOfflineControls
        {...base}
        isOnline
        userHasOfflineSave
        hasTripContent
        itinerarySyncState="syncing"
        tripPlanLoading
      />,
    );
    expect(screen.getByText(/syncing/i)).toBeInTheDocument();
  });

  it("shows_retry_when_sync_failed", () => {
    const onRetry = jest.fn();
    render(
      <ItineraryOfflineControls
        {...base}
        isOnline
        userHasOfflineSave
        hasTripContent
        itinerarySyncState="failed"
        onRetrySync={onRetry}
      />,
    );
    screen.getByRole("button", { name: /retry/i }).click();
    expect(onRetry).toHaveBeenCalled();
  });
});

/** @jest-environment jsdom */
import { describe, it, expect } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { OfflineItineraryStatus } from "@/components/offline/OfflineItineraryStatus";

const noop = () => {};

const base = {
  tripPlanError: null as const,
  isLoading: false,
  lastDeviceSavedAt: null,
  idbSupported: true,
  onSaveOrRefresh: noop,
  onRemoveLocal: noop,
  isSaveBusy: false,
};

describe("OfflineItineraryStatus", () => {
  it("shows_minimal_chrome_when_online_fresh_trip_is_loading", () => {
    const { container } = render(
      <OfflineItineraryStatus
        {...base}
        isOnline
        isShowingCached={false}
        hasTripContent={false}
        isLoading
      />,
    );
    expect(container.textContent).toBe("");
  });

  it("shows_offline_bar_when_offline_with_cached_trip", () => {
    render(
      <OfflineItineraryStatus
        {...base}
        isOnline={false}
        isShowingCached
        hasTripContent
        lastDeviceSavedAt={Date.now()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/You’re offline/i);
    expect(screen.getByRole("status")).toHaveTextContent(/Last saved to this device/i);
  });

  it("shows_offline_no_data_hint_when_offline_with_no_trip", () => {
    render(
      <OfflineItineraryStatus
        {...base}
        isOnline={false}
        isShowingCached={false}
        hasTripContent={false}
      />,
    );
    expect(screen.getByText(/Reconnect to load your trip/i)).toBeInTheDocument();
  });

  it("shows_stale_message_when_online_but_server_used_cache", () => {
    render(
      <OfflineItineraryStatus
        {...base}
        isOnline
        isShowingCached
        hasTripContent
        lastDeviceSavedAt={Date.now() - 60_000}
      />,
    );
    expect(
      screen.getByText(/couldn’t load the latest version from the server/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update from server/i })).toBeInTheDocument();
  });

  it("shows_travel_help_when_online_with_fresh_trip", () => {
    render(
      <OfflineItineraryStatus
        {...base}
        isOnline
        isShowingCached={false}
        hasTripContent
        lastDeviceSavedAt={Date.now()}
      />,
    );
    expect(screen.getByText(/Travel without Wi‑Fi/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Refresh saved copy/i })).toBeInTheDocument();
  });

  it("shows_step_list_when_no_offline_copy_available", () => {
    render(
      <OfflineItineraryStatus
        {...base}
        isOnline
        isShowingCached={false}
        hasTripContent={false}
        tripPlanError="offline_unavailable"
      />,
    );
    expect(screen.getByText(/To view this plan without internet/i)).toBeInTheDocument();
    expect(screen.getByText(/Itinerary/i)).toBeInTheDocument();
  });
});

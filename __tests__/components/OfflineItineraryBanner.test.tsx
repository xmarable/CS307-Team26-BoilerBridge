/** @jest-environment jsdom */
import { describe, it, expect } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { OfflineItineraryBanner } from "@/components/offline/OfflineItineraryBanner";

describe("OfflineItineraryBanner", () => {
  it("hides_when_online_and_not_cached", () => {
    const { container } = render(
      <OfflineItineraryBanner isOffline={false} isShowingCached={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows_offline_with_cached_copy", () => {
    render(<OfflineItineraryBanner isOffline isShowingCached />);
    expect(
      screen.getByRole("status"),
    ).toHaveTextContent(/offline.*saved copy/i);
  });

  it("shows_offline_without_cache_message", () => {
    render(<OfflineItineraryBanner isOffline isShowingCached={false} />);
    expect(screen.getByRole("status")).toHaveTextContent(/connect to load/i);
  });

  it("shows_cached_stale_message_when_online", () => {
    render(<OfflineItineraryBanner isOffline={false} isShowingCached />);
    expect(screen.getByRole("status")).toHaveTextContent(/saved copy/i);
  });
});

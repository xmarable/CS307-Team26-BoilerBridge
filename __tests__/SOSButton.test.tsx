/** @jest-environment jsdom */

import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Use dynamic import to ensure the component loads after any potential setup
const { SOSButton } = await import("../components/SOSButton");

describe("SOSButton Acceptance Criteria", () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = jest.fn<any>();

    // Setup window.location mock for dialing logic
    Object.defineProperty(window, "location", {
      value: { href: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  /**
   * AC 1: Local Emergency Numbers for Foreign Regions
   * Given I am in a foreign country,
   * When I tap the SOS button,
   * Then the app displays the specific local emergency services numbers for that region.
   */
  it("Given I am in a foreign country, When I tap the SOS button, Then the app displays the specific local emergency services numbers for that region", async () => {
    // [Action] Simulate being in France (Foreign Region)
    render(<SOSButton initialLocation="FR" />);

    // [Action] Open the SOS interface
    fireEvent.click(screen.getByRole("button"));

    // [Assertion] Verify the region label updated to France
    expect(await screen.findByText(/France/i)).toBeInTheDocument();

    // [Assertion] Verify local French numbers (17, 18, 15) are displayed instead of 911
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.queryByText("911")).not.toBeInTheDocument();
  });

  /**
   * AC 2: High-Stress UI Accessibility
   * Given I am in a high-stress situation,
   * When I open the SOS menu,
   * Then the interface must use large touch targets to prevent accidental misclicks.
   */
  it("Given I am in a high-stress situation, When I open the SOS menu, Then the interface must use large touch targets to prevent accidental misclicks", async () => {
    render(<SOSButton />);

    fireEvent.click(screen.getByRole("button"));

    // [Action] Filter for the interactive service buttons
    const buttons = screen
      .getAllByRole("button")
      .filter((btn) => /Police|Ambulance|Fire/i.test(btn.textContent || ""));

    buttons.forEach((button) => {
      // [Assertion] Verify padding (p-8) provides a large hit area
      expect(button).toHaveClass("p-8");
      // [Assertion] Verify full-width (w-full) provides a wide horizontal target
      expect(button).toHaveClass("w-full");
      // [Assertion] Verify scale feedback (active:scale-95) for tactile confirmation
      expect(button).toHaveClass("active:scale-95");
    });
  });

  /**
   * AC 3: Offline Data Reliability
   * Given I have no cellular data,
   * When I trigger the SOS view,
   * Then the numbers remain accessible via offline storage.
   */
  it("Given I have no cellular data, When I trigger the SOS view, Then the numbers remain accessible via offline storage", async () => {
    render(<SOSButton />);

    // [Action] Trigger the SOS view via the global event listener
    await act(async () => {
      window.dispatchEvent(new Event("open-sos"));
    });

    // [Assertion] Verify numbers are rendered (proving they exist in local constants)
    const numbers = await screen.findAllByText("911");
    expect(numbers.length).toBeGreaterThan(0);

    // [Assertion] Confirm zero fetch calls were made (proves no network dependency)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  /**
   * UI Cleanup/Utility Test
   * Verifies the SOS overlay can be dismissed after use.
   */
  it("should close the emergency overlay when the close button is tapped", async () => {
    render(<SOSButton />);

    fireEvent.click(screen.getByRole("button"));
    await screen.findByText(/Emergency/i);

    // [Action] Locate the close button by its specific positioning class
    const closeBtn = screen
      .getAllByRole("button")
      .find((btn) => btn.className.includes("absolute top-8"));

    if (closeBtn) fireEvent.click(closeBtn);

    // [Assertion] Verify modal is removed from the DOM
    expect(screen.queryByText(/Emergency/i)).not.toBeInTheDocument();
  });
});

/** @jest-environment jsdom */
import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// mock the toggle icons/lucide stuff if needed
await jest.unstable_mockModule("lucide-react", () => ({
  CloudRain: () => <span data-testid="rain-icon" />,
  Sun: () => <span data-testid="sun-icon" />,
  Columns: () => <span data-testid="compare-icon" />,
}));

const { RainyDayToggle } = await import("@/components/RainyDayToggle");

const mockTrip = {
  primaryItinerary: [{ name: "Park Walk", isOutdoor: true }],
  rainyDayItinerary: [{ name: "Local Coffee Shop", isOutdoor: false }],
};

describe("User Story #8: Rainy Day UI", () => {
  it("given it starts raining, when I hit the 'Rainy Day' toggle, then the app replaces outdoor spots with indoor alternatives", () => {
    render(<RainyDayToggle trip={mockTrip} />);

    // initially shows primary
    expect(screen.getByText("Park Walk")).toBeInTheDocument();

    // click the rainy day toggle
    const rainyBtn = screen.getByRole("button", { name: /rainy day/i });
    fireEvent.click(rainyBtn);

    // AC: then the app replaces outdoor spots
    expect(screen.queryByText("Park Walk")).not.toBeInTheDocument();
    expect(screen.getByText("Local Coffee Shop")).toBeInTheDocument();
  });

  it("implement a side-by-side comparison view to help groups vote on the switch", () => {
    render(<RainyDayToggle trip={mockTrip} />);

    const compareBtn = screen.getByRole("button", { name: /compare/i });
    fireEvent.click(compareBtn);

    // both should be visible in side-by-side mode
    expect(screen.getByText("Primary Plan")).toBeInTheDocument();
    expect(screen.getByText("Rainy Day Plan")).toBeInTheDocument();
    expect(screen.getByText("Park Walk")).toBeInTheDocument();
    expect(screen.getByText("Local Coffee Shop")).toBeInTheDocument();
  });
});

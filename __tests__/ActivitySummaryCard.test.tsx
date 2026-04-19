/** @jest-environment jsdom */

import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActivitySummaryCard } from "@/components/ActivitySummaryCard";

describe("ActivitySummaryCard (US15 loading / US16 booking affordance)", () => {
  const originalOpen = window.open;

  beforeEach(() => {
    global.fetch = jest.fn() as jest.Mock;
    window.open = jest.fn() as typeof window.open;
  });

  afterEach(() => {
    window.open = originalOpen;
    jest.clearAllMocks();
  });

  it("shows skeletons while review summary is loading", () => {
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    const { container } = render(<ActivitySummaryCard activityId="507f1f77bcf86cd799439011" />);

    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it("opens bookingUrl in a new tab when summary includes bookingUrl (US16)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          summary: {
            averageRating: 4.2,
            sentimentSummary: "Nice.",
            highlights: ["A"],
            pros: [],
            cons: [],
            bookingUrl: "https://vendor.example/tickets",
            activityName: "Concert Hall",
          },
        }),
    });

    render(<ActivitySummaryCard activityId="507f1f77bcf86cd799439011" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /book now/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /book now/i }));

    expect(window.open).toHaveBeenCalledWith(
      "https://vendor.example/tickets",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("falls back to Google search when bookingUrl is absent (US16)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          summary: {
            averageRating: 4,
            sentimentSummary: "Ok.",
            highlights: [],
            pros: [],
            cons: [],
            activityName: "Jazz Club",
          },
        }),
    });

    render(<ActivitySummaryCard activityId="507f1f77bcf86cd799439011" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /book now/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /book now/i }));

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining("https://www.google.com/search?q="),
      "_blank",
      "noopener,noreferrer",
    );
  });
});

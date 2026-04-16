/** @jest-environment jsdom */

import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

await jest.unstable_mockModule("next/image", () => ({
  default: function MockImage(props: { alt: string }) {
    return <img alt={props.alt} data-testid="mock-image" />;
  },
}));

const { ActivityDetailContent } = await import("@/components/ActivityDetailContent");

describe("ActivityDetailContent (US15)", () => {
  beforeEach(() => {
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    render(<ActivityDetailContent activityId="507f1f77bcf86cd799439011" />);

    expect(screen.getByLabelText("Loading activity details")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("renders activity name, reference links, and external link attributes", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          activity: {
            name: "Riverside Museum",
            address: "1 River Rd",
            rating: 4.5,
            reviewCount: 12,
            shortSummary: "Great for families.",
            description: "Full description text.",
            referenceLinks: [{ title: "Guide", url: "https://guide.example/m" }],
            infoUrl: "https://museum.example",
          },
        }),
    });

    render(<ActivityDetailContent activityId="507f1f77bcf86cd799439011" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1, name: "Riverside Museum" })).toBeInTheDocument();
    });

    expect(screen.getByText("Great for families.")).toBeInTheDocument();
    expect(screen.getByText("Full description text.")).toBeInTheDocument();

    const guide = screen.getByRole("link", { name: "Guide" });
    expect(guide).toHaveAttribute("href", "https://guide.example/m");
    expect(guide).toHaveAttribute("target", "_blank");
    expect(guide).toHaveAttribute("rel", "noopener noreferrer");

    const official = screen.getByRole("link", { name: "Visit website" });
    expect(official).toHaveAttribute("href", "https://museum.example");
  });

  it("renders without reference or info links when omitted (no crash)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          activity: {
            name: "Minimal Place",
            rating: null,
            reviewCount: 0,
            referenceLinks: [],
          },
        }),
    });

    render(<ActivityDetailContent activityId="507f1f77bcf86cd799439011" />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Minimal Place" })).toBeInTheDocument();
    });

    expect(screen.queryByRole("heading", { name: "Links" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Visit website" })).not.toBeInTheDocument();
  });

  it("shows error alert when the API returns a non-OK response", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server busy" }),
    });

    render(<ActivityDetailContent activityId="507f1f77bcf86cd799439011" />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText("Server busy")).toBeInTheDocument();
  });
});

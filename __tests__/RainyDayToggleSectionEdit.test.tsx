/** @jest-environment jsdom */
import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

await jest.unstable_mockModule("lucide-react", () => ({
  CloudRain: () => <span data-testid="rain-icon" />,
  Sun: () => <span data-testid="sun-icon" />,
  Columns: () => <span data-testid="compare-icon" />,
  ChevronRight: () => <span data-testid="chevron-icon" />,
  Pencil: () => <span data-testid="pencil-icon" />,
  XIcon: () => <span data-testid="x-icon" />,
  GripVertical: () => <span data-testid="grip-icon" />,
}));

const { RainyDayToggle } = await import("@/components/RainyDayToggle");

const baseTrip = {
  itineraryVersion: 0,
  primaryItinerary: [
    {
      dayId: "11111111-1111-1111-1111-111111111111",
      itineraryActivityId: "22222222-2222-2222-2222-222222222222",
      name: "Museum",
      startTime: "2026-08-01T10:00:00.000Z",
      endTime: "2026-08-01T12:00:00.000Z",
      isOutdoor: false,
      location: "Downtown",
      category: "culture",
      activityId: "",
    },
  ],
  rainyDayItinerary: [
    {
      dayId: "11111111-1111-1111-1111-111111111111",
      itineraryActivityId: "33333333-3333-3333-3333-333333333333",
      name: "Cafe",
      startTime: "2026-08-01T10:00:00.000Z",
      endTime: "2026-08-01T12:00:00.000Z",
      isOutdoor: false,
      activityId: "",
    },
  ],
};

describe("US16 RainyDayToggle section editing", () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("US16_optimistic_itinerary_section_edit_rolls_back_on_api_failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "Itinerary version conflict" }),
    });

    render(
      <RainyDayToggle
        trip={baseTrip}
        tripId="507f1f77bcf86cd799439011"
        canEdit
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Edit$/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Museum renamed" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/conflict|fail/i);
    });
    expect(screen.getByText("Museum")).toBeInTheDocument();
    expect(screen.queryByText("Museum renamed")).not.toBeInTheDocument();
  });

  it("US16_AC1_activity_edit_success_updates_visible_title_after_server_ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        itineraryVersion: 1,
        primaryItinerary: [
          {
            ...baseTrip.primaryItinerary[0],
            name: "Museum Prime",
          },
        ],
        rainyDayItinerary: baseTrip.rainyDayItinerary,
      }),
    });

    render(
      <RainyDayToggle
        trip={baseTrip}
        tripId="507f1f77bcf86cd799439011"
        canEdit
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Edit$/i }));
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Museum Prime" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText("Museum Prime")).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalled();
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.scope).toBe("activity");
    expect(body.version).toBe(0);
    expect(body.updates?.name).toBe("Museum Prime");
  });
});

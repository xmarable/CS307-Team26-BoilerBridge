/** @jest-environment jsdom */

import { jest } from "@jest/globals";
import "@testing-library/jest-dom";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

const mockPush = jest.fn();

await jest.unstable_mockModule("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { userId: "u1", name: "Test" } },
    status: "authenticated",
  })),
}));

await jest.unstable_mockModule("next/navigation", () => ({
  useParams: jest.fn(() => ({ tripId: "trip-one" })),
  useSearchParams: jest.fn(() => new URLSearchParams("returnGroup=g-group-1")),
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

await import("next-auth/react");
await import("next/navigation");

const EditTripPage = (await import("@/app/dashboard/trip/[tripId]/edit/page")).default;

describe("EditTripPage (US14 preferences)", () => {
  beforeEach(() => {
    mockPush.mockClear();
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/trip/trip-one")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              _id: "trip-one",
              groupID: "g-group-1",
              fromCity: "Chicago",
              toCity: "Denver",
              fromDate: "2026-06-01T12:00:00.000Z",
              toDate: "2026-06-05T12:00:00.000Z",
              mode: "bus",
              budget: 2400,
              tripConfirmed: false,
              avoidActivities: ["Bars"],
              avoidLocations: ["Downtown"],
              budgetMin: 200,
              budgetMax: 800,
              mustHaves: [
                { _id: "mh1", name: "Botanic garden", status: "approved" },
              ],
            }),
        } as Response);
      }
      if (url.includes("/api/activities")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ activities: [] }),
        } as Response);
      }
      if (url.includes("/api/trip/budget-recommendations")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ recommendations: [] }),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({}),
      } as Response);
    }) as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("prefills budget, avoid lists, and budget range from saved trip", async () => {
    render(<EditTripPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("2400")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("Chicago")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Denver")).toBeInTheDocument();
    expect(screen.getByText("Bars")).toBeInTheDocument();
    expect(screen.getByText("Downtown")).toBeInTheDocument();
    expect(screen.getByDisplayValue("200")).toBeInTheDocument();
    expect(screen.getByDisplayValue("800")).toBeInTheDocument();
    expect(screen.getByText("Botanic garden")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /edit trip preferences/i }),
    ).toBeInTheDocument();
  });
});

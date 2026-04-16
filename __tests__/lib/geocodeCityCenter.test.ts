import { afterEach, describe, expect, it, jest } from "@jest/globals";

const originalFetch = global.fetch;

describe("geocodeCityCenter", () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns lat/lng from Geocoding API JSON", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () =>
        Promise.resolve({
          status: "OK",
          results: [{ geometry: { location: { lat: 41.8781, lng: -87.6298 } } }],
        }),
    });

    const { geocodeCityCenter } = await import("@/lib/travel/geocodeCityCenter");
    const out = await geocodeCityCenter("fake-key", "Chicago, IL");
    expect(out).toEqual({ latitude: 41.8781, longitude: -87.6298 });
    expect(global.fetch).toHaveBeenCalled();
  });

  it("returns null on non-OK status", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: "ZERO_RESULTS", results: [] }),
    });
    const { geocodeCityCenter } = await import("@/lib/travel/geocodeCityCenter");
    expect(await geocodeCityCenter("k", "NowhereXYZ123")).toBeNull();
  });
});

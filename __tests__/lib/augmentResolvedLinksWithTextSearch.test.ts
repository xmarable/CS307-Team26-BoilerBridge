import { afterEach, describe, expect, it, jest } from "@jest/globals";

const searchPlacesText = jest.fn();
const geocodeCityCenter = jest.fn();

await jest.unstable_mockModule("@/lib/travel/geocodeCityCenter", () => ({
  geocodeCityCenter,
}));

await jest.unstable_mockModule("@/lib/travel/googlePlaces", () => ({
  searchPlacesText,
}));

const { augmentResolvedLinksWithTextSearch } = await import(
  "@/lib/itinerary/augmentResolvedLinksWithTextSearch"
);

describe("augmentResolvedLinksWithTextSearch", () => {
  const oldKey = process.env.GOOGLE_MAPS_API_KEY;

  afterEach(() => {
    searchPlacesText.mockReset();
    geocodeCityCenter.mockReset();
    process.env.GOOGLE_MAPS_API_KEY = oldKey;
  });

  it("fills linkedPlaceId from first text search hit when API key is set", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    geocodeCityCenter.mockResolvedValue({ latitude: 41.9, longitude: -87.6 });
    searchPlacesText.mockResolvedValue([
      { placeId: "ChIJresult", name: "Navy Pier", address: "Chicago" },
    ]);

    const events = [
      {
        title: "Navy Pier stroll",
        description: "",
        startTime: new Date("2026-08-01T10:00:00Z"),
        endTime: new Date("2026-08-01T11:00:00Z"),
        location: "Chicago",
        eventType: "activity",
        timezone: "UTC",
      },
    ];
    const out = await augmentResolvedLinksWithTextSearch(events, [{}], {
      toCity: "Chicago",
    });
    expect(searchPlacesText).toHaveBeenCalledWith(
      "test-key",
      expect.stringMatching(/Navy Pier stroll.*Chicago/i),
      10,
      expect.objectContaining({
        bias: expect.objectContaining({ latitude: 41.9, longitude: -87.6 }),
      }),
    );
    expect(out[0]?.linkedPlaceId).toBe("ChIJresult");
  });

  it("skips search when no API key", async () => {
    delete process.env.GOOGLE_MAPS_API_KEY;
    const events = [
      {
        title: "Only title",
        description: "",
        startTime: new Date("2026-08-01T10:00:00Z"),
        endTime: new Date("2026-08-01T11:00:00Z"),
        eventType: "activity",
        timezone: "UTC",
      },
    ];
    const out = await augmentResolvedLinksWithTextSearch(events, [{}]);
    expect(searchPlacesText).not.toHaveBeenCalled();
    expect(out[0]).toEqual({});
  });

  it("picks Chicago chain location over NYC when trip destination is Chicago", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "k";
    geocodeCityCenter.mockResolvedValue({ latitude: 41.88, longitude: -87.63 });
    searchPlacesText.mockResolvedValue([
      {
        placeId: "ChIJ_nyc",
        name: "The Cheesecake Factory",
        address: "43 W 43rd St, New York, NY 10036, USA",
      },
      {
        placeId: "ChIJ_chi",
        name: "The Cheesecake Factory",
        address: "875 N Michigan Ave, Chicago, IL 60611, USA",
      },
    ]);
    const events = [
      {
        title: "The Cheesecake Factory",
        description: "",
        startTime: new Date("2026-08-01T10:00:00Z"),
        endTime: new Date("2026-08-01T11:00:00Z"),
        eventType: "activity",
        timezone: "UTC",
      },
    ];
    const out = await augmentResolvedLinksWithTextSearch(events, [{}], {
      toCity: "Chicago",
    });
    expect(out[0]?.linkedPlaceId).toBe("ChIJ_chi");
    expect(out[0]?.linkedLocationHint).toContain("Chicago");
  });

  it("does not override existing linkedActivityId", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "k";
    geocodeCityCenter.mockResolvedValue(null);
    searchPlacesText.mockResolvedValue([{ placeId: "X", name: "Y", address: "" }]);
    const events = [
      {
        title: "Thing",
        description: "",
        startTime: new Date("2026-08-01T10:00:00Z"),
        endTime: new Date("2026-08-01T11:00:00Z"),
        eventType: "activity",
        timezone: "UTC",
      },
    ];
    const out = await augmentResolvedLinksWithTextSearch(events, [
      { linkedActivityId: "507f1f77bcf86cd799439011" },
    ]);
    expect(out[0]?.linkedActivityId).toBe("507f1f77bcf86cd799439011");
    expect(out[0]?.linkedPlaceId).toBeUndefined();
    expect(searchPlacesText).not.toHaveBeenCalled();
  });
});

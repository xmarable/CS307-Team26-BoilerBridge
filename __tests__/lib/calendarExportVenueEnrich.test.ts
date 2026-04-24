import { jest } from "@jest/globals";

const updateOneMock = jest.fn(async () => ({}));
const leanMock = jest.fn();
const selectMock = jest.fn(() => ({ lean: leanMock }));
const findMock = jest.fn(() => ({ select: selectMock }));
const fetchGoogleMock = jest.fn();
const calendarEventUpdateOneMock = jest.fn(async () => ({}));

await jest.unstable_mockModule("@/models/Activity", () => ({
  default: {
    find: findMock,
    updateOne: updateOneMock,
  },
}));

await jest.unstable_mockModule("@/models/CalendarEvent", () => ({
  default: {
    find: jest.fn(() => ({ sort: jest.fn(() => ({ lean: jest.fn(async () => []) })) })),
    updateOne: calendarEventUpdateOneMock,
  },
}));

await jest.unstable_mockModule("@/lib/travel/geocodeCityCenter", () => ({
  geocodeCityCenter: jest.fn(async () => ({
    latitude: 18.4,
    longitude: -66.05,
  })),
}));

await jest.unstable_mockModule("@/lib/travel/googlePlaces", () => ({
  fetchGooglePlaceEnrichment: fetchGoogleMock,
}));

const { attachVenueAccessibilityToCalendarEvents } = await import(
  "@/lib/calendarExport"
);

describe("attachVenueAccessibilityToCalendarEvents liveEnrich", () => {
  const activityId = "507f1f77bcf86cd799439011";
  const placeId = "ChIJTestPlaceIdExample";

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    findMock.mockClear();
    selectMock.mockClear();
    leanMock.mockClear();
    updateOneMock.mockClear();
    fetchGoogleMock.mockClear();
    calendarEventUpdateOneMock.mockClear();
  });

  it("merges Google mobility fields and persists missing Activity fields when liveEnrich is true", async () => {
    leanMock.mockResolvedValue([
      {
        _id: activityId,
        placeId,
        wheelchairAccessible: undefined,
        stepFree: undefined,
        accessibleRestroom: undefined,
        hearingAssistance: undefined,
        visualAssistance: undefined,
      },
    ]);
    fetchGoogleMock.mockResolvedValue({
      placeId,
      reviews: [],
      wheelchairAccessible: true,
      stepFree: true,
      accessibleRestroom: false,
    });

    const events = [{ linkedActivityId: activityId }];
    const out = await attachVenueAccessibilityToCalendarEvents(events, {
      liveEnrich: true,
    });

    expect(fetchGoogleMock).toHaveBeenCalledWith(
      "test-key",
      expect.objectContaining({ placeId }),
    );
    expect(out[0].venueAccessibility).toMatchObject({
      wheelchairAccessible: true,
      stepFree: true,
      accessibleRestroom: false,
    });
    expect(updateOneMock).toHaveBeenCalledWith(
      { _id: activityId },
      {
        $set: {
          wheelchairAccessible: true,
          stepFree: true,
          accessibleRestroom: false,
        },
      },
    );
  });

  it("does not call Google when liveEnrich is false", async () => {
    leanMock.mockResolvedValue([
      {
        _id: activityId,
        placeId,
        wheelchairAccessible: undefined,
        stepFree: undefined,
        accessibleRestroom: undefined,
        hearingAssistance: undefined,
        visualAssistance: undefined,
      },
    ]);

    await attachVenueAccessibilityToCalendarEvents(
      [{ linkedActivityId: activityId }],
      { liveEnrich: false },
    );

    expect(fetchGoogleMock).not.toHaveBeenCalled();
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it("fills venueAccessibility from Google for linkedPlaceId when no Activity row exists", async () => {
    leanMock.mockResolvedValue([]);
    fetchGoogleMock.mockResolvedValue({
      placeId,
      reviews: [],
      wheelchairAccessible: false,
      stepFree: false,
      accessibleRestroom: true,
    });

    const out = await attachVenueAccessibilityToCalendarEvents(
      [{ linkedPlaceId: placeId }],
      { liveEnrich: true },
    );

    expect(fetchGoogleMock).toHaveBeenCalled();
    expect(out[0].venueAccessibility).toMatchObject({
      wheelchairAccessible: false,
      stepFree: false,
      accessibleRestroom: true,
    });
    expect(updateOneMock).not.toHaveBeenCalled();
  });

  it("uses Google text search when there is no linked place or activity id", async () => {
    leanMock.mockResolvedValue([]);
    fetchGoogleMock.mockImplementation(async (_key: string, opts: { placeId?: string | null }) => {
      if (opts?.placeId) return null;
      return {
        placeId: "ChIJtextResolved",
        reviews: [],
        wheelchairAccessible: true,
        stepFree: true,
        accessibleRestroom: true,
      };
    });

    const out = await attachVenueAccessibilityToCalendarEvents(
      [
        {
          _id: "64b0b0b0b0b0b0b0b0b0b0b0",
          title: "Explore San Juan (day 1)",
          location: "San Juan",
          itineraryDestinationCity: "San Juan",
        },
      ],
      { liveEnrich: true },
    );

    expect(findMock).not.toHaveBeenCalled();
    expect(fetchGoogleMock).toHaveBeenCalled();
    expect(out[0].venueAccessibility).toMatchObject({
      wheelchairAccessible: true,
      stepFree: true,
      accessibleRestroom: true,
    });
    expect(calendarEventUpdateOneMock).toHaveBeenCalledWith(
      { _id: "64b0b0b0b0b0b0b0b0b0b0b0" },
      { $set: { linkedPlaceId: "ChIJtextResolved" } },
    );
  });
});

import { describe, expect, it } from "@jest/globals";
import { buildCalendarActivityDetailHref } from "@/lib/calendarActivityDetailLink";

describe("buildCalendarActivityDetailHref", () => {
  it("links to activity page when linkedActivityId is set", () => {
    expect(
      buildCalendarActivityDetailHref({
        title: "Museum",
        linkedActivityId: "507f1f77bcf86cd799439011",
        source: "itinerary",
      }),
    ).toBe("/dashboard/activities/507f1f77bcf86cd799439011");
  });

  it("links to place preview when linkedPlaceId is set", () => {
    const href = buildCalendarActivityDetailHref({
      title: "Skydeck",
      linkedPlaceId: "ChIJfake",
      location: "Chicago",
      source: "itinerary",
    });
    expect(href).toContain("/dashboard/activities/preview?");
    expect(href).toContain("placeId=ChIJfake");
    expect(href).toContain("name=Skydeck");
    expect(href).toContain("address=Chicago");
  });

  it("uses name+address preview for itinerary rows without ids (graceful fallback)", () => {
    const href = buildCalendarActivityDetailHref({
      title: "River Cruise",
      location: "Chicago River",
      source: "itinerary",
    });
    expect(href).toBe(
      "/dashboard/activities/preview?name=River+Cruise&address=Chicago+River",
    );
  });

  it("adds destination query for itinerary preview when itineraryDestinationCity is set", () => {
    const href = buildCalendarActivityDetailHref({
      title: "Cheesecake Factory",
      source: "itinerary",
      itineraryDestinationCity: "Chicago",
    });
    expect(href).toContain("name=Cheesecake+Factory");
    expect(href).toContain("destination=Chicago");
  });

  it("does not add text fallback for manual events without links", () => {
    expect(
      buildCalendarActivityDetailHref({
        title: "Team sync",
        location: "Zoom",
        source: "manual",
      }),
    ).toBeUndefined();
  });

  it("returns undefined for itinerary title shorter than 2 chars", () => {
    expect(
      buildCalendarActivityDetailHref({
        title: "A",
        source: "itinerary",
      }),
    ).toBeUndefined();
  });
});

import { buildBookingPlan, deriveHintTags } from "@/lib/travel/bookingIntel";
import { buildExpediaHotelSearchUrl } from "@/lib/travel/expediaRapid";

describe("bookingIntel", () => {
  const expedia = buildExpediaHotelSearchUrl("Test City Museum");

  it("uses direct Book now only when manual URL is https", () => {
    const plan = buildBookingPlan({
      name: "Museum",
      address: "1 Main",
      manualBookingUrl: "https://tickets.example/event",
      googleMapsUri: null,
      googleTypes: ["museum"],
      expediaUrl: expedia,
      expediaSource: "hotel-search-fallback",
    });
    expect(plan.mode).toBe("direct");
    expect(plan.primary?.label).toBe("Book now");
    expect(plan.primary?.url).toMatch(/^https:\/\//);
  });

  it("does not surface Book now for parks without manual booking", () => {
    const plan = buildBookingPlan({
      name: "Metro Park",
      address: null,
      manualBookingUrl: null,
      googleMapsUri: null,
      googleTypes: ["park"],
      expediaUrl: expedia,
      expediaSource: "hotel-search-fallback",
    });
    expect(plan.mode).toBe("explore");
    expect(plan.primary).toBeUndefined();
    expect(plan.bookingNote).toBeTruthy();
  });

  it("prioritizes Expedia for lodging with https URL", () => {
    const plan = buildBookingPlan({
      name: "Grand Hotel",
      address: "NYC",
      manualBookingUrl: null,
      googleMapsUri: null,
      googleTypes: ["lodging"],
      expediaUrl: "https://www.expedia.com/Hotel-Search?destination=NYC",
      expediaSource: "hotel-search-fallback",
    });
    expect(plan.mode).toBe("lodging_nearby");
    expect(plan.primary?.label).toMatch(/Expedia/i);
  });

  it("deriveHintTags returns sightseeing for museums", () => {
    expect(deriveHintTags(["museum", "point_of_interest"])).toContain("Sightseeing");
  });
});

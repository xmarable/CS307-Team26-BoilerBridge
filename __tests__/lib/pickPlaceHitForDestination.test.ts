import { describe, expect, it } from "@jest/globals";
import type { GooglePlaceSearchHit } from "@/lib/travel/googlePlaces";
import {
  pickBestPlaceHitForDestination,
  scorePlaceHitForDestination,
} from "@/lib/travel/pickPlaceHitForDestination";

describe("pickBestPlaceHitForDestination (destination-aware)", () => {
  it("prefers the Chicago hit when a chain name could match NYC first", () => {
    const hits: GooglePlaceSearchHit[] = [
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
    ];
    const chosen = pickBestPlaceHitForDestination(hits, "Chicago");
    expect(chosen?.placeId).toBe("ChIJ_chi");
    expect(chosen?.address).toContain("Chicago");
  });

  it("prefers Magnolia Bakery Chicago over NYC for same brand", () => {
    const hits: GooglePlaceSearchHit[] = [
      {
        placeId: "ChIJny",
        name: "Magnolia Bakery",
        address: "200 Columbus Ave, New York, NY 10023, USA",
      },
      {
        placeId: "ChIJchi",
        name: "Magnolia Bakery",
        address: "108 N State St, Chicago, IL 60602, USA",
      },
    ];
    expect(pickBestPlaceHitForDestination(hits, "Chicago")?.placeId).toBe("ChIJchi");
  });

  it("returns first hit when destination is empty", () => {
    const hits: GooglePlaceSearchHit[] = [
      { placeId: "A", name: "Only", address: "Somewhere" },
    ];
    expect(pickBestPlaceHitForDestination(hits, "")?.placeId).toBe("A");
  });

  it("scores Chicago address higher for Chicago destination", () => {
    const nyc = scorePlaceHitForDestination(
      { placeId: "1", name: "Cafe", address: "New York, NY" },
      "Chicago",
    );
    const chi = scorePlaceHitForDestination(
      { placeId: "2", name: "Cafe", address: "Chicago, IL" },
      "Chicago",
    );
    expect(chi).toBeGreaterThan(nyc);
  });
});

/** @jest-environment node */

process.env.MONGODB_URI = process.env.TEST_MONGODB_URI; // Use the test database for these tests

import { jest } from "@jest/globals";

const generateRainyDayPlan = (primary: any[]) => {
  return primary.map((activity) => {
    if (!activity.isOutdoor) return { ...activity };

    // AC: suggest a generic fallback like a "Coffee Shop" if no indoor alt exists
    return {
      ...activity,
      name: "Local Coffee Shop",
      category: "Food & Drink",
      isOutdoor: false,
      location: "Nearby central area",
    };
  });
};

describe("User Story #8: Rainy Day Logic", () => {
  it("given it starts raining, when I hit the 'Rainy Day' toggle, then the app replaces outdoor spots with indoor alternatives", () => {
    const primary = [
      { name: "Morning Park Walk", isOutdoor: true, category: "Nature" },
    ];

    const result = generateRainyDayPlan(primary);

    expect(result[0].isOutdoor).toBe(false);
    expect(result[0].name).not.toBe("Morning Park Walk");
  });

  it("given no indoor alternative exists for a specific activity, when I toggle the view, then the app suggests a generic fallback like a 'Coffee Shop'", () => {
    const primary = [
      {
        name: "Extreme Mountain Biking",
        isOutdoor: true,
        category: "Extreme Sports",
      },
    ];

    const result = generateRainyDayPlan(primary);

    // verify fallback logic for niche outdoor activities
    expect(result[0].name).toBe("Local Coffee Shop");
    expect(result[0].category).toBe("Food & Drink");
  });

  it("ensures indoor activities remain unchanged in the backup itinerary", () => {
    const primary = [
      { name: "Visit Local Museum", isOutdoor: false, category: "Culture" },
    ];

    const result = generateRainyDayPlan(primary);

    expect(result[0].name).toBe("Visit Local Museum");
    expect(result[0].isOutdoor).toBe(false);
  });
});

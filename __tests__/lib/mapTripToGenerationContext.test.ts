import { mapTripToGenerationContext } from "@/lib/itinerary/mapTripToGenerationContext";

describe("mapTripToGenerationContext", () => {
  it("maps saved trip settings into generator context", () => {
    const mapped = mapTripToGenerationContext({
      fromCity: "Chicago",
      toCity: "New York",
      fromDate: "2026-07-01T00:00:00.000Z",
      toDate: "2026-07-04T00:00:00.000Z",
      mode: "train",
      budget: 1200,
      budgetMin: 700,
      budgetMax: 1500,
      avoidActivities: ["Bars"],
      avoidLocations: ["Downtown"],
    });

    expect(mapped.fromCity).toBe("Chicago");
    expect(mapped.toCity).toBe("New York");
    expect(mapped.mode).toBe("train");
    expect(mapped.budget).toBe(1200);
    expect(mapped.budgetMin).toBe(700);
    expect(mapped.budgetMax).toBe(1500);
    expect(mapped.avoidActivities).toEqual(["Bars"]);
    expect(mapped.avoidLocations).toEqual(["Downtown"]);
  });

  it("passes through a higher budget for lavish trip hints", () => {
    const mapped = mapTripToGenerationContext({
      fromCity: "Chicago",
      toCity: "Paris",
      fromDate: "2026-07-01T00:00:00.000Z",
      toDate: "2026-07-05T00:00:00.000Z",
      mode: "flight",
      budget: 12000,
      avoidActivities: ["Casinos"],
    });
    expect(mapped.budget).toBe(12000);
    expect(mapped.avoidActivities).toEqual(["Casinos"]);
  });

  it("uses safe defaults for missing optional fields", () => {
    const mapped = mapTripToGenerationContext({
      fromDate: "2026-07-01T00:00:00.000Z",
      toDate: "2026-07-03T00:00:00.000Z",
      budget: "0",
      avoidActivities: null,
      avoidLocations: undefined,
    });

    expect(mapped.fromCity).toBe("Unknown origin");
    expect(mapped.toCity).toBe("Unknown destination");
    expect(mapped.mode).toBe("flight");
    expect(mapped.budget).toBe(500);
    expect(mapped.avoidActivities).toEqual([]);
    expect(mapped.avoidLocations).toEqual([]);
    expect(mapped.budgetMin).toBeUndefined();
    expect(mapped.budgetMax).toBeUndefined();
  });
});

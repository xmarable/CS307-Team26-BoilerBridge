import { describe, expect, it } from "@jest/globals";
import {
  applyRecommendationFilters,
  filterByAvoid,
  filterByBudgetRange,
  matchesAvoidList,
} from "@/lib/tripRecommendations";

describe("tripRecommendations (US14)", () => {
  describe("matchesAvoidList / filterByAvoid", () => {
    it("excludes items whose name matches avoidActivities", () => {
      expect(matchesAvoidList("Downtown Bar Crawl", "100 Main", ["bar"], [])).toBe(
        true,
      );
    });

    it("excludes items whose address matches avoidLocations", () => {
      expect(
        matchesAvoidList("Nice Restaurant", "123 Strip Vegas", [], ["strip"]),
      ).toBe(true);
    });

    it("keeps items when no avoid terms match", () => {
      expect(matchesAvoidList("Museum visit", "Art District", ["zoo"], ["airport"])).toBe(
        false,
      );
    });

    it("filterByAvoid applies both activity and location lists", () => {
      const items = [
        { name: "Zoo day", estimatedCost: 20 },
        { name: "Park walk", address: "Airport Road 1", estimatedCost: 0 },
        { name: "Cafe", address: "Main St", estimatedCost: 5 },
      ];
      const out = filterByAvoid(items, ["zoo"], ["airport"]);
      expect(out.map((i) => i.name)).toEqual(["Cafe"]);
    });
  });

  describe("filterByBudgetRange", () => {
    it("drops items outside min/max when estimatedCost is set", () => {
      const items = [
        { name: "Cheap", estimatedCost: 5 },
        { name: "Mid", estimatedCost: 50 },
        { name: "Pricey", estimatedCost: 200 },
      ];
      expect(filterByBudgetRange(items, 10, 100).map((i) => i.name)).toEqual(["Mid"]);
    });

    it("keeps items with no estimatedCost (unknown cost)", () => {
      const items = [{ name: "Unknown" }];
      expect(filterByBudgetRange(items as { name: string; estimatedCost?: number }[], 100, 200)).toHaveLength(
        1,
      );
    });
  });

  describe("applyRecommendationFilters", () => {
    it("applies avoid lists then budget range", () => {
      const items = [
        { name: "Bars tour", estimatedCost: 25 },
        { name: "Museum", estimatedCost: 15 },
        { name: "Opera", estimatedCost: 5 },
      ];
      const out = applyRecommendationFilters(items, {
        avoidActivities: ["bars"],
        budgetMin: 10,
        budgetMax: 20,
      });
      expect(out.map((i) => i.name)).toEqual(["Museum"]);
    });
  });
});

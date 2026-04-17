import { describe, expect, it } from "@jest/globals";

import { assignOptionGroupIds } from "@/lib/itinerary/clusterOptionGroups";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";

describe("assignOptionGroupIds", () => {
  it("puts overlapping same-day activities in one group", () => {
    const day = new Date("2026-06-01T12:00:00Z");
    const a: ProposedEventInput = {
      title: "Museum",
      startTime: new Date(day.getTime()),
      endTime: new Date(day.getTime() + 60 * 60 * 1000),
      timezone: "UTC",
      eventType: "activity",
    };
    const b: ProposedEventInput = {
      title: "Gallery",
      startTime: new Date(day.getTime() + 30 * 60 * 1000),
      endTime: new Date(day.getTime() + 90 * 60 * 1000),
      timezone: "UTC",
      eventType: "activity",
    };
    const g = assignOptionGroupIds([a, b]);
    expect(g[0]).toBeTruthy();
    expect(g[0]).toBe(g[1]);
  });

  it("assigns empty group id for travel-like events", () => {
    const day = new Date("2026-06-01T12:00:00Z");
    const t: ProposedEventInput = {
      title: "Travel: A → B (flight)",
      startTime: day,
      endTime: new Date(day.getTime() + 3 * 60 * 60 * 1000),
      timezone: "UTC",
      eventType: "travel",
    };
    const g = assignOptionGroupIds([t]);
    expect(g[0]).toBe("");
  });
});

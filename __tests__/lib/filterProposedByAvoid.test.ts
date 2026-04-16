import { describe, expect, it } from "@jest/globals";
import { filterProposedEventsByAvoidLists } from "@/lib/itinerary/filterProposedByAvoid";

describe("filterProposedEventsByAvoidLists", () => {
  const base = {
    startTime: new Date("2026-08-01T10:00:00.000Z"),
    endTime: new Date("2026-08-01T12:00:00.000Z"),
    eventType: "activity" as const,
    timezone: "UTC",
  };

  it("removes events whose title matches an avoided activity", () => {
    const out = filterProposedEventsByAvoidLists(
      [
        { title: "Explore Paris (day 1)", ...base },
        { title: "Coffee tasting", ...base },
      ],
      ["explore"],
      [],
      [],
    );
    expect(out.map((e) => e.title)).toEqual(["Coffee tasting"]);
  });

  it("keeps events that match an approved must-have even if they match avoid text", () => {
    const out = filterProposedEventsByAvoidLists(
      [{ title: "Museum day pass", ...base }],
      ["museum"],
      [],
      [{ name: "Museum day pass" }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("Museum day pass");
  });

  it("returns all events when avoid lists are empty", () => {
    const events = [{ title: "Anything", ...base }];
    expect(filterProposedEventsByAvoidLists(events, [], [], [])).toEqual(events);
  });

  it("removes events whose location matches an avoided location (US14)", () => {
    const out = filterProposedEventsByAvoidLists(
      [
        { title: "Lunch", location: "Downtown Plaza", ...base },
        { title: "Snack", location: "Uptown", ...base },
      ],
      [],
      ["downtown"],
      [],
    );
    expect(out.map((e) => e.title)).toEqual(["Snack"]);
  });
});

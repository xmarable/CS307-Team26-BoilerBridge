import {
  finalizeItineraryProposedEvents,
  repairItinerarySlice,
} from "@/lib/itinerary/finalizeItineraryProposedEvents";
import type { TripContext } from "@/lib/itinerary/generatePartial";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import { inferPlanningTimezone } from "@/lib/itinerary/inferPlanningTimezone";
import { utcForZonedWallClock } from "@/lib/itinerary/zonedWallClock";

function ev(p: ProposedEventInput): ProposedEventInput {
  return p;
}

describe("finalizeItineraryProposedEvents", () => {
  const busTrip: TripContext = {
    fromCity: "West Lafayette, IN",
    toCity: "Chicago, IL",
    fromDate: new Date("2026-06-10T12:00:00.000Z"),
    toDate: new Date("2026-06-12T12:00:00.000Z"),
    mode: "bus",
    budget: 800,
  };

  it("prepends outbound travel and delays same-day attractions until after arrival window", () => {
    const tz = inferPlanningTimezone(busTrip.toCity, busTrip.fromCity);
    const p0 = { year: 2026, month: 6, day: 10, hour: 9, minute: 0 };
    const badStart = utcForZonedWallClock(tz, p0.year, p0.month, p0.day, p0.hour, p0.minute);
    const badEnd = new Date(badStart.getTime() + 60 * 60 * 1000);

    const out = finalizeItineraryProposedEvents(
      [
        ev({
          title: "Skydeck Chicago",
          startTime: badStart,
          endTime: badEnd,
          location: "Chicago",
          eventType: "activity",
        }),
      ],
      busTrip,
    );

    const travel = out.find((e) => /Travel:/i.test(e.title));
    expect(travel).toBeDefined();
    expect(travel!.eventType).toMatch(/travel/i);
    const sky = out.find((e) => e.title.includes("Skydeck"));
    expect(sky).toBeDefined();
    expect(sky!.startTime.getTime()).toBeGreaterThanOrEqual(travel!.endTime.getTime());
  });

  it("caps unrealistic all-day attraction duration", () => {
    const tz = inferPlanningTimezone(busTrip.toCity, busTrip.fromCity);
    const start = utcForZonedWallClock(tz, 2026, 6, 11, 10, 0);
    const end = new Date(start.getTime() + 12 * 60 * 60 * 1000);
    const out = finalizeItineraryProposedEvents(
      [
        ev({
          title: "Neighborhood stroll",
          startTime: start,
          endTime: end,
          eventType: "activity",
        }),
      ],
      busTrip,
    );
    const stroll = out.find((e) => e.title.includes("Neighborhood"));
    expect(stroll).toBeDefined();
    const durH = (stroll!.endTime.getTime() - stroll!.startTime.getTime()) / (60 * 60 * 1000);
    expect(durH).toBeLessThanOrEqual(3.01);
  });

  it("repairItinerarySlice does not add travel rows", () => {
    const tz = inferPlanningTimezone(busTrip.toCity, busTrip.fromCity);
    const a = utcForZonedWallClock(tz, 2026, 6, 11, 10, 0);
    const b = new Date(a.getTime() + 2 * 60 * 60 * 1000);
    const c = new Date(a.getTime() + 30 * 60 * 1000);
    const d = new Date(c.getTime() + 2 * 60 * 60 * 1000);
    const out = repairItinerarySlice(
      [
        ev({ title: "First", startTime: a, endTime: b, eventType: "activity" }),
        ev({ title: "Second", startTime: c, endTime: d, eventType: "activity" }),
      ],
      busTrip,
    );
    expect(out.some((e) => /Travel:/i.test(e.title))).toBe(false);
    expect(out[0]!.endTime.getTime()).toBeLessThanOrEqual(out[1]!.startTime.getTime());
  });
});

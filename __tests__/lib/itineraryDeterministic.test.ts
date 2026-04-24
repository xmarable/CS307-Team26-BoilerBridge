import { finalizeItineraryProposedEvents } from "@/lib/itinerary/finalizeItineraryProposedEvents";
import type { TripContext } from "@/lib/itinerary/generatePartial";
import {
  getDeterministicItineraryIssues,
  mergeItineraryValidationIssues,
  normalizeProposedEventCategories,
  repairLocationTitleCityMismatches,
} from "@/lib/itinerary/itineraryDeterministic";
import { getItineraryChronologyIssues } from "@/lib/itinerary/itineraryChronology";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import {
  isStrictOutboundIntercityLeg,
  isStrictReturnIntercityLeg,
} from "@/lib/itinerary/travelHeuristics";
import { utcForZonedWallClock } from "@/lib/itinerary/zonedWallClock";

const TZ = "America/New_York";

function ev(p: ProposedEventInput): ProposedEventInput {
  return p;
}

describe("Chicago → Miami Apr 24–29, 2026 (flight) regression", () => {
  const trip: TripContext = {
    fromCity: "Chicago",
    toCity: "Miami",
    fromDate: utcForZonedWallClock(TZ, 2026, 4, 24, 0, 0),
    toDate: utcForZonedWallClock(TZ, 2026, 4, 29, 22, 0),
    mode: "flight",
    budget: 1500,
  };

  it("finalizes to single outbound and at most one return, sorted without overlaps", () => {
    const apr24 = (h1: number, m1: number, h2: number, m2: number) => ({
      s: utcForZonedWallClock(TZ, 2026, 4, 24, h1, m1),
      e: utcForZonedWallClock(TZ, 2026, 4, 24, h2, m2),
    });
    const apr25 = (h1: number, m1: number, h2: number, m2: number) => ({
      s: utcForZonedWallClock(TZ, 2026, 4, 25, h1, m1),
      e: utcForZonedWallClock(TZ, 2026, 4, 25, h2, m2),
    });
    const apr26 = (h1: number, m1: number, h2: number, m2: number) => ({
      s: utcForZonedWallClock(TZ, 2026, 4, 26, h1, m1),
      e: utcForZonedWallClock(TZ, 2026, 4, 26, h2, m2),
    });
    const apr28a = utcForZonedWallClock(TZ, 2026, 4, 28, 10, 0);
    const apr28b = utcForZonedWallClock(TZ, 2026, 4, 28, 14, 0);
    const apr28c = utcForZonedWallClock(TZ, 2026, 4, 28, 18, 0);
    const apr29a = utcForZonedWallClock(TZ, 2026, 4, 29, 10, 0);
    const apr29b = utcForZonedWallClock(TZ, 2026, 4, 29, 14, 0);

    const d1 = apr24(6, 0, 10, 0);
    const d2 = apr25(10, 0, 12, 0);
    const d3 = apr26(11, 0, 13, 0);

    const raw: ProposedEventInput[] = [
      ev({
        title: "Flight Chicago to Miami",
        startTime: d1.s,
        endTime: d1.e,
        eventType: "transport",
      }),
      ev({
        title: "Arrival in Miami",
        startTime: utcForZonedWallClock(TZ, 2026, 4, 24, 11, 0),
        endTime: utcForZonedWallClock(TZ, 2026, 4, 24, 12, 0),
      }),
      ev({
        title: "Little Havana walk",
        startTime: d2.s,
        endTime: d2.e,
        location: "Miami",
        eventType: "transport",
      }),
      ev({
        title: "Visit Willis Tower",
        startTime: d3.s,
        endTime: d3.e,
        location: "Chicago, IL",
        eventType: "activity",
      }),
      ev({
        title: "Return flight Miami to Chicago",
        startTime: apr28a,
        endTime: apr28b,
        eventType: "transport",
      }),
      ev({
        title: "Return flight Miami to Chicago (duplicate)",
        startTime: utcForZonedWallClock(TZ, 2026, 4, 28, 15, 0),
        endTime: apr28c,
        eventType: "transport",
      }),
      ev({
        title: "Beach time in Miami",
        startTime: apr29a,
        endTime: apr29b,
        location: "Miami Beach",
        eventType: "activity",
      }),
    ];

    const out = finalizeItineraryProposedEvents(raw, trip);
    const outbound = out.filter((e) => isStrictOutboundIntercityLeg(e, trip));
    const ret = out.filter((e) => isStrictReturnIntercityLeg(e, trip));
    expect(outbound.length).toBeLessThanOrEqual(1);
    expect(ret.length).toBeLessThanOrEqual(1);
    expect(out.some((e) => /Willis/i.test(e.title))).toBe(false);
    const lh = out.find((e) => /Little Havana/i.test(e.title));
    expect(lh?.eventType).not.toMatch(/^transport$/i);
    expect(out.some((e) => /Beach time/i.test(e.title))).toBe(false);

    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.startTime.getTime()).toBeGreaterThanOrEqual(out[i - 1]!.startTime.getTime());
      expect(out[i]!.startTime.getTime()).toBeGreaterThanOrEqual(out[i - 1]!.endTime.getTime());
    }

    const issues = mergeItineraryValidationIssues(
      out,
      trip,
      getItineraryChronologyIssues(out, trip),
    );
    expect(issues).toEqual([]);
  });

  it("repairs Arrival in Chicago with Miami-only address", () => {
    const fixed = repairLocationTitleCityMismatches(
      [
        ev({
          title: "Arrival in Chicago",
          startTime: utcForZonedWallClock(TZ, 2026, 4, 29, 8, 0),
          endTime: utcForZonedWallClock(TZ, 2026, 4, 29, 9, 0),
          location: "Miami International Airport (MIA)",
        }),
      ],
      trip,
    );
    expect(fixed[0]!.location).toMatch(/Chicago/i);
  });

  it("demotes mislabeled transport on food/sight titles", () => {
    const out = normalizeProposedEventCategories(
      [
        ev({
          title: "Dinner in Brickell",
          startTime: utcForZonedWallClock(TZ, 2026, 4, 25, 19, 0),
          endTime: utcForZonedWallClock(TZ, 2026, 4, 25, 20, 30),
          eventType: "transport",
        }),
      ],
      trip,
    );
    expect(out[0]!.eventType).toBe("food");
  });

  it("flags bad LLM rows before repair", () => {
    const bad: ProposedEventInput[] = [
      ev({
        title: "Return flight Miami to Chicago",
        startTime: utcForZonedWallClock(TZ, 2026, 4, 28, 10, 0),
        endTime: utcForZonedWallClock(TZ, 2026, 4, 28, 14, 0),
        eventType: "transport",
      }),
      ev({
        title: "Return flight Miami to Chicago #2",
        startTime: utcForZonedWallClock(TZ, 2026, 4, 28, 16, 0),
        endTime: utcForZonedWallClock(TZ, 2026, 4, 28, 20, 0),
        eventType: "transport",
      }),
    ];
    expect(getDeterministicItineraryIssues(bad, trip).some((m) => /Multiple return/i.test(m))).toBe(
      true,
    );
  });
});

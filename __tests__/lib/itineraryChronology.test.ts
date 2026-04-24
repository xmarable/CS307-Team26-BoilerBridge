import {
  dedupeRedundantArrivalEvents,
  getItineraryChronologyIssues,
  isArrivalOrCheckinAtDestination,
  repairIntercityDayOneSequence,
} from "@/lib/itinerary/itineraryChronology";
import type { TripContext } from "@/lib/itinerary/generatePartial";
import { normalizeProposedTimeline } from "@/lib/itinerary/normalizeProposedTimeline";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import {
  isStrictOutboundIntercityLeg,
  isStrictReturnIntercityLeg,
} from "@/lib/itinerary/travelHeuristics";
import { utcForZonedWallClock } from "@/lib/itinerary/zonedWallClock";

const TZ = "America/New_York";

function ev(
  title: string,
  start: Date,
  end: Date,
  extra?: Partial<ProposedEventInput>,
): ProposedEventInput {
  return { title, startTime: start, endTime: end, ...extra };
}

describe("itineraryChronology (Chicago → Miami regression)", () => {
  const trip: TripContext = {
    fromCity: "Chicago",
    toCity: "Miami",
    fromDate: utcForZonedWallClock(TZ, 2026, 4, 24, 0, 0),
    toDate: utcForZonedWallClock(TZ, 2026, 4, 26, 23, 0),
    mode: "flight",
    budget: 1200,
  };

  it("flags impossible Ollama-style order before repair", () => {
    const arrivalMorning = ev(
      "Arrival in Miami",
      utcForZonedWallClock(TZ, 2026, 4, 24, 8, 0),
      utcForZonedWallClock(TZ, 2026, 4, 24, 9, 0),
    );
    const flight = ev(
      "Flights from Chicago to Miami",
      utcForZonedWallClock(TZ, 2026, 4, 24, 18, 45),
      utcForZonedWallClock(TZ, 2026, 4, 24, 21, 15),
      { eventType: "transport" },
    );
    const airportArrival = ev(
      "Arrival at Miami Airport",
      utcForZonedWallClock(TZ, 2026, 4, 24, 22, 0),
      utcForZonedWallClock(TZ, 2026, 4, 24, 23, 0),
    );
    const raw = [arrivalMorning, flight, airportArrival];
    const issues = getItineraryChronologyIssues(raw, trip);
    expect(issues.some((m) => /before outbound travel/i.test(m))).toBe(true);
  });

  it("repairs so arrival is after outbound flight and validation passes", () => {
    const arrivalMorning = ev(
      "Arrival in Miami",
      utcForZonedWallClock(TZ, 2026, 4, 24, 8, 0),
      utcForZonedWallClock(TZ, 2026, 4, 24, 9, 0),
    );
    const flight = ev(
      "Flights from Chicago to Miami",
      utcForZonedWallClock(TZ, 2026, 4, 24, 18, 45),
      utcForZonedWallClock(TZ, 2026, 4, 24, 21, 15),
      { eventType: "transport" },
    );
    const airportArrival = ev(
      "Arrival at Miami Airport",
      utcForZonedWallClock(TZ, 2026, 4, 24, 22, 0),
      utcForZonedWallClock(TZ, 2026, 4, 24, 23, 0),
    );
    const out = normalizeProposedTimeline([arrivalMorning, flight, airportArrival], {
      trip,
    });
    const flightEv = out.find((e) => /Chicago to Miami/i.test(e.title));
    expect(flightEv).toBeDefined();
    const arrivals = out.filter((e) => isArrivalOrCheckinAtDestination(e, trip));
    expect(arrivals.length).toBeGreaterThanOrEqual(1);
    for (const a of arrivals) {
      expect(a.startTime.getTime()).toBeGreaterThanOrEqual(flightEv!.endTime.getTime());
    }
    expect(getItineraryChronologyIssues(out, trip)).toEqual([]);
  });

  it("removes duplicate arrival-style rows on day 1", () => {
    const flight = ev(
      "Flights from Chicago to Miami",
      utcForZonedWallClock(TZ, 2026, 4, 24, 18, 45),
      utcForZonedWallClock(TZ, 2026, 4, 24, 21, 15),
    );
    const a1 = ev(
      "Arrival in Miami",
      utcForZonedWallClock(TZ, 2026, 4, 24, 22, 0),
      utcForZonedWallClock(TZ, 2026, 4, 24, 22, 45),
    );
    const a2 = ev(
      "Arrival at Miami Airport",
      utcForZonedWallClock(TZ, 2026, 4, 24, 22, 30),
      utcForZonedWallClock(TZ, 2026, 4, 24, 23, 0),
    );
    const tz = TZ;
    let rows = repairIntercityDayOneSequence([flight, a1, a2], trip, tz);
    rows = dedupeRedundantArrivalEvents(rows, trip, tz);
    const arrivalLike = rows.filter((e) => isArrivalOrCheckinAtDestination(e, trip));
    expect(arrivalLike.length).toBeLessThanOrEqual(1);
  });
});

describe("itineraryChronology invariants", () => {
  const trip: TripContext = {
    fromCity: "Chicago",
    toCity: "Miami",
    fromDate: new Date("2026-04-24T12:00:00.000Z"),
    toDate: new Date("2026-04-26T12:00:00.000Z"),
    mode: "flight",
    budget: 800,
  };

  it("rejects endTime before or equal to startTime", () => {
    const issues = getItineraryChronologyIssues(
      [
        ev("Bad", new Date("2026-04-24T14:00:00.000Z"), new Date("2026-04-24T13:00:00.000Z")),
      ],
      trip,
    );
    expect(issues.some((m) => /endTime must be after startTime/i.test(m))).toBe(true);
  });

  it("detects same-day overlaps", () => {
    const issues = getItineraryChronologyIssues(
      [
        ev("A", new Date("2026-04-24T14:00:00.000Z"), new Date("2026-04-24T16:00:00.000Z")),
        ev("B", new Date("2026-04-24T15:00:00.000Z"), new Date("2026-04-24T17:00:00.000Z")),
      ],
      trip,
    );
    expect(issues.some((m) => /Overlap/i.test(m))).toBe(true);
  });

  it("keeps a valid itinerary unchanged in issue list", () => {
    const flight = ev(
      "Flight Chicago to Miami",
      utcForZonedWallClock(TZ, 2026, 4, 24, 10, 0),
      utcForZonedWallClock(TZ, 2026, 4, 24, 14, 0),
    );
    const lunch = ev(
      "Lunch in Miami",
      utcForZonedWallClock(TZ, 2026, 4, 24, 15, 0),
      utcForZonedWallClock(TZ, 2026, 4, 24, 16, 0),
      { location: "Miami" },
    );
    const normalized = normalizeProposedTimeline([flight, lunch], { trip });
    expect(getItineraryChronologyIssues(normalized, trip)).toEqual([]);
  });

  it("sorts activities chronologically after normalize", () => {
    const a = ev(
      "Late",
      new Date("2026-04-24T20:00:00.000Z"),
      new Date("2026-04-24T21:00:00.000Z"),
    );
    const b = ev(
      "Early",
      new Date("2026-04-24T12:00:00.000Z"),
      new Date("2026-04-24T13:00:00.000Z"),
    );
    const out = normalizeProposedTimeline([a, b], { trip: { ...trip, fromCity: "A", toCity: "A" } });
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.startTime.getTime()).toBeGreaterThanOrEqual(
        out[i - 1]!.startTime.getTime(),
      );
    }
  });
});

describe("strict intercity leg detection", () => {
  const trip: TripContext = {
    fromCity: "Chicago, IL",
    toCity: "Miami, FL",
    fromDate: new Date(),
    toDate: new Date(),
    mode: "flight",
    budget: 1,
  };

  it("treats Chicago→Miami flight copy as outbound", () => {
    expect(
      isStrictOutboundIntercityLeg(
        { title: "Flights from Chicago to Miami", eventType: "transport" },
        trip,
      ),
    ).toBe(true);
  });

  it("does not treat bare destination arrival as outbound transport", () => {
    expect(isStrictOutboundIntercityLeg({ title: "Arrival in Miami" }, trip)).toBe(false);
  });

  it("detects synthetic return Travel row", () => {
    expect(
      isStrictReturnIntercityLeg({ title: "Travel: Miami, FL → Chicago, IL" }, trip),
    ).toBe(true);
  });
});

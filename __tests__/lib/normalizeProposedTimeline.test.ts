import { normalizeProposedTimeline } from "@/lib/itinerary/normalizeProposedTimeline";
import type { TripContext } from "@/lib/itinerary/generatePartial";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";

function ev(
  title: string,
  start: string,
  end: string,
  extra?: Partial<ProposedEventInput>,
): ProposedEventInput {
  return {
    title,
    startTime: new Date(start),
    endTime: new Date(end),
    ...extra,
  };
}

describe("normalizeProposedTimeline", () => {
  it("sorts by start time", () => {
    const base = "2026-04-18T12:00:00.000Z";
    const out = normalizeProposedTimeline([
      ev("B", "2026-04-18T16:00:00.000Z", "2026-04-18T17:00:00.000Z"),
      ev("A", base, "2026-04-18T13:00:00.000Z"),
    ]);
    expect(out[0]!.title).toBe("A");
    expect(out[1]!.title).toBe("B");
  });

  it("shifts overlapping events so the next starts when the previous ends", () => {
    const out = normalizeProposedTimeline([
      ev("First", "2026-04-18T13:00:00.000Z", "2026-04-18T17:00:00.000Z"),
      ev("Second", "2026-04-18T14:00:00.000Z", "2026-04-18T15:00:00.000Z"),
    ]);
    expect(out[0]!.endTime.getTime()).toBeLessThanOrEqual(
      out[1]!.startTime.getTime(),
    );
    expect(out[1]!.startTime.toISOString()).toBe("2026-04-18T17:00:00.000Z");
    const dur =
      out[1]!.endTime.getTime() - out[1]!.startTime.getTime();
    expect(dur).toBe(60 * 60 * 1000);
  });

  it("repairs end before start using minimum duration", () => {
    const out = normalizeProposedTimeline([
      ev("Bad", "2026-04-18T10:00:00.000Z", "2026-04-18T09:00:00.000Z"),
    ]);
    expect(out[0]!.endTime.getTime()).toBeGreaterThan(out[0]!.startTime.getTime());
  });

  it("uses trip-aware finalize when trip option is passed", () => {
    const trip: TripContext = {
      fromCity: "West Lafayette, IN",
      toCity: "Chicago, IL",
      fromDate: new Date("2026-06-10T12:00:00.000Z"),
      toDate: new Date("2026-06-11T12:00:00.000Z"),
      mode: "bus",
      budget: 500,
    };
    const out = normalizeProposedTimeline(
      [
        ev("Museum", "2026-06-10T15:00:00.000Z", "2026-06-10T16:00:00.000Z", {
          eventType: "activity",
        }),
      ],
      { trip },
    );
    expect(out.some((e) => /Travel:/i.test(e.title))).toBe(true);
  });

  it("uses slice repair when slice flag is set", () => {
    const trip: TripContext = {
      fromCity: "A",
      toCity: "B",
      fromDate: new Date("2026-06-10"),
      toDate: new Date("2026-06-11"),
      mode: "flight",
      budget: 500,
    };
    const out = normalizeProposedTimeline(
      [
        ev("One", "2026-06-10T15:00:00.000Z", "2026-06-10T16:00:00.000Z"),
        ev("Two", "2026-06-10T15:30:00.000Z", "2026-06-10T16:30:00.000Z"),
      ],
      { trip, slice: true },
    );
    expect(out.some((e) => /Travel:/i.test(e.title))).toBe(false);
    expect(out[0]!.endTime.getTime()).toBeLessThanOrEqual(out[1]!.startTime.getTime());
  });
});

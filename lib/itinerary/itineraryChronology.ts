import type { TripContext } from "@/lib/itinerary/generatePartial";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import { inferPlanningTimezone } from "@/lib/itinerary/inferPlanningTimezone";
import {
  intraCityTransitionMs,
  isInterCityTrip,
  isStrictOutboundIntercityLeg,
  isStrictReturnIntercityLeg,
  mainCityToken,
} from "@/lib/itinerary/travelHeuristics";
import { zonedDayKey } from "@/lib/itinerary/zonedWallClock";

const MIN_DURATION_MS = 30 * 60 * 1000;
const DEFAULT_DURATION_MS = 90 * 60 * 1000;

function sortByStart(events: ProposedEventInput[]): ProposedEventInput[] {
  return [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export function isArrivalOrCheckinAtDestination(
  ev: { title: string; description?: string; location?: string },
  trip: TripContext,
): boolean {
  const blob = `${ev.title} ${ev.description ?? ""} ${ev.location ?? ""}`.toLowerCase();
  if (!/\b(arrival|arrive|arriving|landed|touch\s*down|check[\s-]?in)\b/i.test(blob)) {
    return false;
  }
  const toTok = mainCityToken(trip.toCity);
  if (toTok.length >= 3 && blob.includes(toTok)) return true;
  if (/\bairport\b/i.test(blob) && toTok.length >= 3 && blob.includes(toTok)) return true;
  return false;
}

function mentionsDestination(ev: ProposedEventInput, trip: TripContext): boolean {
  const blob = `${ev.title} ${ev.location ?? ""}`.toLowerCase();
  const toTok = mainCityToken(trip.toCity);
  return toTok.length >= 3 && blob.includes(toTok);
}

function firstTripDayOutboundEndMs(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): number {
  const k = zonedDayKey(trip.fromDate, tz);
  let maxEnd = 0;
  for (const ev of events) {
    if (zonedDayKey(ev.startTime, tz) !== k) continue;
    if (!isStrictOutboundIntercityLeg(ev, trip)) continue;
    maxEnd = Math.max(maxEnd, ev.endTime.getTime());
  }
  return maxEnd;
}

function latestFirstDayArrivalEndMs(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
  outboundEndMs: number,
): number {
  const k = zonedDayKey(trip.fromDate, tz);
  let maxEnd = 0;
  for (const ev of events) {
    if (zonedDayKey(ev.startTime, tz) !== k) continue;
    if (!isArrivalOrCheckinAtDestination(ev, trip)) continue;
    if (ev.startTime.getTime() < outboundEndMs) continue;
    maxEnd = Math.max(maxEnd, ev.endTime.getTime());
  }
  return maxEnd;
}

function clampDurationMs(ms: number): number {
  if (!Number.isFinite(ms) || ms < MIN_DURATION_MS) return DEFAULT_DURATION_MS;
  return Math.min(ms, 4 * 60 * 60 * 1000);
}

/**
 * Moves destination arrival/check-in blocks that incorrectly precede the first
 * outbound intercity leg on day 1, and shifts obvious destination-tagged
 * activities to after the last arrival block that day.
 */
export function repairIntercityDayOneSequence(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  if (!isInterCityTrip(trip) || events.length === 0) return events;

  const buffer = intraCityTransitionMs(trip.mode);
  const outboundEnd = firstTripDayOutboundEndMs(events, trip, tz);
  if (outboundEnd === 0) return events;

  const minAfterOutbound = outboundEnd + buffer;

  let next = events.map((ev) => {
    const sameFirst =
      zonedDayKey(ev.startTime, tz) === zonedDayKey(trip.fromDate, tz);
    if (!sameFirst) return ev;
    if (isStrictOutboundIntercityLeg(ev, trip)) return ev;
    if (!isArrivalOrCheckinAtDestination(ev, trip)) return ev;
    if (ev.startTime.getTime() >= minAfterOutbound) return ev;
    const rawDur = Math.max(ev.endTime.getTime() - ev.startTime.getTime(), MIN_DURATION_MS);
    const d = clampDurationMs(rawDur);
    const start = new Date(minAfterOutbound);
    return { ...ev, startTime: start, endTime: new Date(start.getTime() + d) };
  });

  const arrivalAnchor = latestFirstDayArrivalEndMs(next, trip, tz, outboundEnd);
  const minAfterArrival =
    arrivalAnchor > 0 ? arrivalAnchor + buffer : minAfterOutbound;

  next = next.map((ev) => {
    const sameFirst =
      zonedDayKey(ev.startTime, tz) === zonedDayKey(trip.fromDate, tz);
    if (!sameFirst) return ev;
    if (isStrictOutboundIntercityLeg(ev, trip)) return ev;
    if (isStrictReturnIntercityLeg(ev, trip)) return ev;
    if (isArrivalOrCheckinAtDestination(ev, trip)) return ev;
    if (!mentionsDestination(ev, trip)) return ev;
    if (ev.startTime.getTime() >= minAfterArrival) return ev;
    const rawDur = Math.max(ev.endTime.getTime() - ev.startTime.getTime(), MIN_DURATION_MS);
    const d = clampDurationMs(rawDur);
    const start = new Date(minAfterArrival);
    return { ...ev, startTime: start, endTime: new Date(start.getTime() + d) };
  });

  return sortByStart(next);
}

export function dedupeRedundantArrivalEvents(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  if (!isInterCityTrip(trip) || events.length === 0) return events;
  const k = zonedDayKey(trip.fromDate, tz);
  const sorted = sortByStart(events);
  const arrivalIdx: number[] = [];
  sorted.forEach((ev, i) => {
    if (zonedDayKey(ev.startTime, tz) !== k) return;
    if (isArrivalOrCheckinAtDestination(ev, trip)) arrivalIdx.push(i);
  });
  if (arrivalIdx.length <= 1) return sorted;

  const outboundEnd = firstTripDayOutboundEndMs(sorted, trip, tz);
  const afterOutbound = arrivalIdx.filter(
    (i) => sorted[i]!.startTime.getTime() >= outboundEnd,
  );
  const keepPool = afterOutbound.length > 0 ? afterOutbound : arrivalIdx;
  const keepIdx = keepPool[keepPool.length - 1]!;
  const drop = new Set(arrivalIdx.filter((i) => i !== keepIdx));
  return sorted.filter((_, i) => !drop.has(i));
}

export function getItineraryChronologyIssues(
  events: ProposedEventInput[],
  trip: TripContext,
): string[] {
  const issues: string[] = [];
  const tz = inferPlanningTimezone(trip.toCity, trip.fromCity);
  const sorted = sortByStart(events);

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    if (ev.endTime.getTime() <= ev.startTime.getTime()) {
      issues.push(`"${ev.title}": endTime must be after startTime`);
    }
    if (i > 0 && ev.startTime.getTime() < sorted[i - 1]!.startTime.getTime()) {
      issues.push("Events are not sorted by startTime");
    }
  }

  const byDay = new Map<string, ProposedEventInput[]>();
  for (const ev of sorted) {
    const key = zonedDayKey(ev.startTime, tz);
    const arr = byDay.get(key) ?? [];
    arr.push(ev);
    byDay.set(key, arr);
  }

  for (const [, dayEvs] of byDay) {
    const d = sortByStart(dayEvs);
    for (let i = 1; i < d.length; i++) {
      const prev = d[i - 1]!;
      const cur = d[i]!;
      if (cur.startTime.getTime() < prev.endTime.getTime()) {
        issues.push(`Overlap on ${zonedDayKey(cur.startTime, tz)}: "${prev.title}" vs "${cur.title}"`);
      }
    }
  }

  if (isInterCityTrip(trip)) {
    const k = zonedDayKey(trip.fromDate, tz);
    const outboundEnd = firstTripDayOutboundEndMs(sorted, trip, tz);
    if (outboundEnd > 0) {
      const buffer = intraCityTransitionMs(trip.mode);
      const boundary = outboundEnd + buffer;
      for (const ev of sorted) {
        if (zonedDayKey(ev.startTime, tz) !== k) continue;
        if (!isArrivalOrCheckinAtDestination(ev, trip)) continue;
        if (ev.startTime.getTime() < boundary) {
          issues.push(
            `Arrival/check-in "${ev.title}" starts before outbound travel completes`,
          );
        }
      }
    }

    const firstKey = zonedDayKey(trip.fromDate, tz);
    const arrivals = sorted.filter(
      (e) =>
        zonedDayKey(e.startTime, tz) === firstKey &&
        isArrivalOrCheckinAtDestination(e, trip),
    );
    if (arrivals.length > 1) {
      issues.push(`Multiple arrival/check-in events on first trip day (${arrivals.length})`);
    }
  }

  return issues;
}

export class ItineraryValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(issues.join("; "));
    this.name = "ItineraryValidationError";
    this.issues = issues;
  }
}

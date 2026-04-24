import type { TripContext } from "@/lib/itinerary/generatePartial";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import { inferPlanningTimezone } from "@/lib/itinerary/inferPlanningTimezone";
import {
  getZonedParts,
  minutesSinceMidnightInZone,
  utcForZonedWallClock,
  zonedDayKey,
} from "@/lib/itinerary/zonedWallClock";
import {
  dedupeRedundantArrivalEvents,
  repairIntercityDayOneSequence,
} from "@/lib/itinerary/itineraryChronology";
import { enforceDeterministicItineraryRules } from "@/lib/itinerary/itineraryDeterministic";
import {
  interCityBlockMs,
  intraCityTransitionMs,
  isInterCityTrip,
  isStrictOutboundIntercityLeg,
  isStrictReturnIntercityLeg,
  isTravelLikeEvent,
  maxActivityDurationMs,
} from "@/lib/itinerary/travelHeuristics";

const MIN_DURATION_MS = 30 * 60 * 1000;
const DEFAULT_DURATION_MS = 90 * 60 * 1000;

function sortByStart(events: ProposedEventInput[]): ProposedEventInput[] {
  return [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

function clampDurationMs(
  rawMs: number,
  ev: { title: string; eventType?: string },
): number {
  if (!Number.isFinite(rawMs) || rawMs < MIN_DURATION_MS) return DEFAULT_DURATION_MS;
  const cap = maxActivityDurationMs(ev);
  return Math.min(rawMs, cap);
}

function firstDayHasOutboundTravel(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): boolean {
  const firstKey = zonedDayKey(trip.fromDate, tz);
  return events.some((ev) => {
    if (zonedDayKey(ev.startTime, tz) !== firstKey) return false;
    return isStrictOutboundIntercityLeg(ev, trip);
  });
}

function injectOutboundTravel(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  if (!isInterCityTrip(trip)) return events;
  if (firstDayHasOutboundTravel(events, trip, tz)) return events;

  const p0 = getZonedParts(trip.fromDate, tz);
  const travelStart = utcForZonedWallClock(tz, p0.year, p0.month, p0.day, 8, 0);
  const dur = interCityBlockMs(trip.mode);
  const travelEnd = new Date(travelStart.getTime() + dur);

  const title = `Travel: ${trip.fromCity} → ${trip.toCity} (${trip.mode})`;
  const travelEv: ProposedEventInput = {
    title,
    description:
      "Intercity travel block (heuristic timing). Activities after this assume you have arrived in the destination city.",
    startTime: travelStart,
    endTime: travelEnd,
    location: `${trip.fromCity} / en route`,
    eventType: "travel",
    timezone: tz,
  };

  const buffer = intraCityTransitionMs(trip.mode);
  const shifted = events.map((ev) => {
    if (isStrictOutboundIntercityLeg(ev, trip)) return ev;
    if (zonedDayKey(ev.startTime, tz) !== zonedDayKey(trip.fromDate, tz)) return ev;
    if (ev.startTime.getTime() >= travelEnd.getTime() + buffer) return ev;
    const rawDur = Math.max(ev.endTime.getTime() - ev.startTime.getTime(), MIN_DURATION_MS);
    const d = clampDurationMs(rawDur, ev);
    const newStart = new Date(travelEnd.getTime() + buffer);
    return {
      ...ev,
      startTime: newStart,
      endTime: new Date(newStart.getTime() + d),
    };
  });

  return sortByStart([travelEv, ...shifted]);
}

function injectReturnTravel(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  if (!isInterCityTrip(trip)) return events;
  const startKey = zonedDayKey(trip.fromDate, tz);
  const endKey = zonedDayKey(trip.toDate, tz);
  if (startKey === endKey) return events;

  if (events.some((e) => isStrictReturnIntercityLeg(e, trip))) {
    return sortByStart(events);
  }

  const lastParts = getZonedParts(trip.toDate, tz);
  const retStart = utcForZonedWallClock(tz, lastParts.year, lastParts.month, lastParts.day, 16, 0);
  const dur = Math.min(interCityBlockMs(trip.mode), 5 * 60 * 60 * 1000);
  const retEnd = new Date(retStart.getTime() + dur);
  const buffer = intraCityTransitionMs(trip.mode);
  const lastActivityEndLimit = retStart.getTime() - buffer;

  const adjusted = events
    .map((ev) => {
      if (zonedDayKey(ev.startTime, tz) !== endKey) return ev;
      if (isTravelLikeEvent(ev) || isStrictReturnIntercityLeg(ev, trip)) return ev;
      if (ev.endTime.getTime() <= lastActivityEndLimit) return ev;
      const rawDur = Math.max(ev.endTime.getTime() - ev.startTime.getTime(), MIN_DURATION_MS);
      const d = clampDurationMs(rawDur, ev);
      const newEnd = new Date(lastActivityEndLimit);
      let newStart = new Date(newEnd.getTime() - d);
      const dayParts = getZonedParts(ev.startTime, tz);
      const dayMorning = utcForZonedWallClock(tz, dayParts.year, dayParts.month, dayParts.day, 8, 0);
      if (newStart.getTime() < dayMorning.getTime()) {
        newStart = dayMorning;
        const end2 = new Date(newStart.getTime() + d);
        return { ...ev, startTime: newStart, endTime: new Date(Math.min(end2.getTime(), lastActivityEndLimit)) };
      }
      return { ...ev, startTime: newStart, endTime: newEnd };
    })
    .filter((ev) => ev.endTime.getTime() > ev.startTime.getTime())
    .filter((ev) => {
      if (zonedDayKey(ev.startTime, tz) !== endKey) return true;
      if (isTravelLikeEvent(ev) || isStrictReturnIntercityLeg(ev, trip)) return true;
      return ev.startTime.getTime() < retStart.getTime();
    });

  const title = `Travel: ${trip.toCity} → ${trip.fromCity} (${trip.mode})`;
  const retEv: ProposedEventInput = {
    title,
    description:
      "Return travel block (heuristic). Activities on this day end before departure when possible.",
    startTime: retStart,
    endTime: retEnd,
    location: `${trip.toCity} / en route`,
    eventType: "travel",
    timezone: tz,
  };

  return sortByStart([...adjusted, retEv]);
}

function bumpNightOwlStarts(events: ProposedEventInput[], tz: string): ProposedEventInput[] {
  return events.map((ev) => {
    if (isTravelLikeEvent(ev)) return ev;
    const mins = minutesSinceMidnightInZone(ev.startTime, tz);
    if (mins >= 5 * 60) return ev;
    const p = getZonedParts(ev.startTime, tz);
    const dayStart = utcForZonedWallClock(tz, p.year, p.month, p.day, 9, 0);
    const rawDur = Math.max(ev.endTime.getTime() - ev.startTime.getTime(), MIN_DURATION_MS);
    const d = clampDurationMs(rawDur, ev);
    return {
      ...ev,
      startTime: dayStart,
      endTime: new Date(dayStart.getTime() + d),
    };
  });
}

function repairWithinEachDay(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  const buffer = intraCityTransitionMs(trip.mode);
  const byDay = new Map<string, ProposedEventInput[]>();
  for (const ev of sortByStart(events)) {
    const k = zonedDayKey(ev.startTime, tz);
    const arr = byDay.get(k) ?? [];
    arr.push(ev);
    byDay.set(k, arr);
  }

  const out: ProposedEventInput[] = [];
  const dayKeys = [...byDay.keys()].sort();
  for (const k of dayKeys) {
    const dayEvents = sortByStart(byDay.get(k) ?? []);
    let prevEnd = 0;
    for (const raw of dayEvents) {
      let start = new Date(raw.startTime);
      let end = new Date(raw.endTime);
      if (Number.isNaN(start.getTime())) start = new Date(prevEnd || Date.now());
      if (Number.isNaN(end.getTime())) end = new Date(start.getTime() + DEFAULT_DURATION_MS);

      const durationMs = clampDurationMs(end.getTime() - start.getTime(), raw);

      if (prevEnd > 0 && start.getTime() < prevEnd + buffer) {
        start = new Date(prevEnd + buffer);
      }

      end = new Date(start.getTime() + durationMs);
      if (end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + MIN_DURATION_MS);
      }

      prevEnd = end.getTime();
      out.push({
        ...raw,
        startTime: start,
        endTime: end,
        timezone: raw.timezone && raw.timezone !== "UTC" ? raw.timezone : tz,
      });
    }
  }
  return sortByStart(out);
}

/**
 * Global pass: strictly increasing timeline (handles cross-day edge cases).
 */
function globalDeOverlap(events: ProposedEventInput[]): ProposedEventInput[] {
  const sorted = sortByStart(events);
  const out: ProposedEventInput[] = [];
  let prevEndMs = 0;
  for (const raw of sorted) {
    let start = new Date(raw.startTime);
    let end = new Date(raw.endTime);
    const durationMs = clampDurationMs(end.getTime() - start.getTime(), raw);
    if (prevEndMs > 0 && start.getTime() < prevEndMs) {
      start = new Date(prevEndMs);
    }
    end = new Date(start.getTime() + durationMs);
    if (end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + MIN_DURATION_MS);
    }
    prevEndMs = end.getTime();
    out.push({ ...raw, startTime: start, endTime: end });
  }
  return out;
}

/**
 * Post-processes LLM itinerary output: travel anchors, intra-day buffers,
 * duration caps, and night-time repairs using a planning timezone inferred
 * from city names (no external routing APIs).
 */
/**
 * Repairs a *slice* of events (partial regenerate) without inserting extra
 * intercity travel rows — keeps the same number of events returned.
 */
export function repairItinerarySlice(events: ProposedEventInput[], trip: TripContext): ProposedEventInput[] {
  if (events.length === 0) return [];
  const tz = inferPlanningTimezone(trip.toCity, trip.fromCity);
  let working = sortByStart(events);
  working = enforceDeterministicItineraryRules(working, trip, tz);
  working = repairIntercityDayOneSequence(working, trip, tz);
  working = dedupeRedundantArrivalEvents(working, trip, tz);
  working = bumpNightOwlStarts(working, tz);
  working = repairWithinEachDay(working, trip, tz);
  working = globalDeOverlap(working);
  return working;
}

/** Full-trip repair including synthetic outbound/return travel when cities differ. */
export function finalizeItineraryProposedEvents(
  events: ProposedEventInput[],
  trip: TripContext,
): ProposedEventInput[] {
  if (events.length === 0) return [];
  const tz = inferPlanningTimezone(trip.toCity, trip.fromCity);

  let working = sortByStart(events);
  working = enforceDeterministicItineraryRules(working, trip, tz);
  working = injectOutboundTravel(working, trip, tz);
  working = injectReturnTravel(working, trip, tz);
  working = enforceDeterministicItineraryRules(working, trip, tz);
  working = bumpNightOwlStarts(working, tz);
  working = repairIntercityDayOneSequence(working, trip, tz);
  working = dedupeRedundantArrivalEvents(working, trip, tz);
  working = repairWithinEachDay(working, trip, tz);
  working = globalDeOverlap(working);
  return working;
}

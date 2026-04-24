import type { TripContext } from "@/lib/itinerary/generatePartial";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import { inferPlanningTimezone } from "@/lib/itinerary/inferPlanningTimezone";
import {
  isStrictOutboundIntercityLeg,
  isStrictReturnIntercityLeg,
  mainCityToken,
} from "@/lib/itinerary/travelHeuristics";
import { getZonedParts, utcForZonedWallClock, zonedDayKey } from "@/lib/itinerary/zonedWallClock";

const CHICAGO_LANDMARK_RE =
  /\b(willis\s+tower|skydeck|cloud\s+gate|the\s+bean|navy\s+pier|magnificent\s+mile|wrigley|millennium\s+park|riverwalk\s+chicago)\b/i;

const FOOD_RE =
  /\b(breakfast|brunch|lunch|dinner|supper|snack|coffee|meal|food|restaurant|bistro|barbecue|bbq|taco|pizza)\b/i;

function sortByStart(events: ProposedEventInput[]): ProposedEventInput[] {
  return [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

export function getTripZonedWallBounds(trip: TripContext, tz: string): { start: Date; end: Date } {
  const p0 = getZonedParts(trip.fromDate, tz);
  const p1 = getZonedParts(trip.toDate, tz);
  const start = utcForZonedWallClock(tz, p0.year, p0.month, p0.day, 0, 0);
  const end = utcForZonedWallClock(tz, p1.year, p1.month, p1.day, 23, 59);
  return { start, end };
}

function blob(ev: ProposedEventInput): string {
  return `${ev.title} ${ev.description ?? ""} ${ev.location ?? ""}`.toLowerCase();
}

export function isRealIntercityTransportLeg(ev: ProposedEventInput, trip: TripContext): boolean {
  if (isStrictOutboundIntercityLeg(ev, trip) || isStrictReturnIntercityLeg(ev, trip)) return true;
  return /^Travel:\s*.+→/i.test(ev.title.trim());
}

function mentionsCityTok(ev: ProposedEventInput, tok: string): boolean {
  if (tok.length < 3) return false;
  return blob(ev).includes(tok);
}

export function clipEventsToTripDateRange(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  const { start, end } = getTripZonedWallBounds(trip, tz);
  const sMs = start.getTime();
  const eMs = end.getTime();
  return events.filter((ev) => {
    if (Number.isNaN(ev.startTime.getTime()) || Number.isNaN(ev.endTime.getTime())) return false;
    return ev.startTime.getTime() <= eMs && ev.endTime.getTime() >= sMs;
  });
}

export function normalizeProposedEventCategories(
  events: ProposedEventInput[],
  trip: TripContext,
): ProposedEventInput[] {
  return events.map((ev) => {
    const et = (ev.eventType ?? "").toLowerCase();
    const transportish = et === "transport" || et === "travel" || et === "transit";
    if (transportish && !isRealIntercityTransportLeg(ev, trip)) {
      if (FOOD_RE.test(ev.title)) return { ...ev, eventType: "food" };
      return { ...ev, eventType: "general" };
    }
    if (!transportish && FOOD_RE.test(ev.title)) return { ...ev, eventType: "food" };
    if (
      !transportish &&
      et !== "food" &&
      /\b(museum|gallery|tour|neighborhood|beach|walk|explore|visit|park|zoo|aquarium)\b/i.test(ev.title)
    ) {
      return { ...ev, eventType: "activity" };
    }
    return ev;
  });
}

export function dedupeStrictIntercityLegs(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  const sorted = sortByStart(events);
  const firstKey = zonedDayKey(trip.fromDate, tz);
  const endKey = zonedDayKey(trip.toDate, tz);

  const outboundIdx = sorted
    .map((e, i) =>
      isStrictOutboundIntercityLeg(e, trip) && zonedDayKey(e.startTime, tz) === firstKey ? i : -1,
    )
    .filter((i) => i >= 0);
  const drop = new Set<number>();
  if (outboundIdx.length > 1) {
    const keep = outboundIdx[0]!;
    for (const i of outboundIdx) {
      if (i !== keep) drop.add(i);
    }
  }

  const returnIdx = sorted
    .map((e, i) => (isStrictReturnIntercityLeg(e, trip) ? i : -1))
    .filter((i) => i >= 0);
  if (returnIdx.length > 1) {
    const onEnd = returnIdx.filter((i) => zonedDayKey(sorted[i]!.startTime, tz) === endKey);
    const pool = onEnd.length > 0 ? onEnd : returnIdx;
    const keepIdx = pool.reduce((best, i) =>
      sorted[i]!.startTime.getTime() > sorted[best]!.startTime.getTime() ? i : best,
    pool[0]!);
    for (const i of returnIdx) {
      if (i !== keepIdx) drop.add(i);
    }
  }

  return sorted.filter((_, i) => !drop.has(i));
}

export function repairLocationTitleCityMismatches(
  events: ProposedEventInput[],
  trip: TripContext,
): ProposedEventInput[] {
  const fromTok = mainCityToken(trip.fromCity);
  const toTok = mainCityToken(trip.toCity);
  return events.map((ev) => {
    const t = ev.title.toLowerCase();
    const loc = (ev.location ?? "").toLowerCase();
    if (!ev.location?.trim()) return ev;

    const mia = /\b(miami|mia|miami\s+international)\b/i.test(loc);
    const chi = /\b(chicago|ord|mdw|o'?hare|midway)\b/i.test(loc);

    if (/\b(arrival|departure)\b/i.test(t) && fromTok.length >= 3 && t.includes(fromTok)) {
      if (mia && !chi) return { ...ev, location: trip.fromCity };
    }
    if (/\b(arrival|departure)\b/i.test(t) && toTok.length >= 3 && t.includes(toTok)) {
      if (chi && !mia) return { ...ev, location: trip.toCity };
    }
    return ev;
  });
}

function isOriginTouristNoise(ev: ProposedEventInput, trip: TripContext): boolean {
  if (isRealIntercityTransportLeg(ev, trip)) return false;
  const b = blob(ev);
  const fromTok = mainCityToken(trip.fromCity);
  const toTok = mainCityToken(trip.toCity);
  if (CHICAGO_LANDMARK_RE.test(b) && !/\bchicago\b/.test(toTok)) return true;
  if (fromTok.length >= 3 && toTok.length >= 3 && /\b(visit|explore|tour)\b/i.test(b)) {
    if (b.includes(fromTok) && !b.includes(toTok)) return true;
  }
  return false;
}

export function dropOriginTourismDuringDestinationStay(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  if (!trip.fromCity.trim() || !trip.toCity.trim()) return events;
  if (trip.fromCity.trim().toLowerCase() === trip.toCity.trim().toLowerCase()) return events;

  const firstKey = zonedDayKey(trip.fromDate, tz);
  const returns = events.filter((e) => isStrictReturnIntercityLeg(e, trip));
  const returnStarts = returns.map((r) => r.startTime.getTime());
  const returnMin = returnStarts.length ? Math.min(...returnStarts) : Number.POSITIVE_INFINITY;

  return events.filter((ev) => {
    const k = zonedDayKey(ev.startTime, tz);
    if (k === firstKey) return true;
    if (isRealIntercityTransportLeg(ev, trip)) return true;
    if (ev.startTime.getTime() >= returnMin) return true;
    if (isOriginTouristNoise(ev, trip)) return false;
    return true;
  });
}

export function dropPostReturnDestinationActivities(
  events: ProposedEventInput[],
  trip: TripContext,
): ProposedEventInput[] {
  const returns = events.filter((e) => isStrictReturnIntercityLeg(e, trip));
  if (returns.length === 0) return events;
  const returnEnd = Math.max(...returns.map((r) => r.endTime.getTime()));
  const toTok = mainCityToken(trip.toCity);
  const fromTok = mainCityToken(trip.fromCity);
  if (toTok.length < 3) return events;

  return events.filter((ev) => {
    if (isRealIntercityTransportLeg(ev, trip)) return true;
    if (ev.startTime.getTime() < returnEnd) return true;
    if (mentionsCityTok(ev, toTok) && !mentionsCityTok(ev, fromTok)) return false;
    return true;
  });
}

export function repairImpossibleSameCalendarMeals(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  const maxFoodMs = 2 * 60 * 60 * 1000;
  return events.map((ev) => {
    if (isRealIntercityTransportLeg(ev, trip)) return ev;
    if (!FOOD_RE.test(ev.title)) return ev;
    const sk = zonedDayKey(ev.startTime, tz);
    const ek = zonedDayKey(ev.endTime, tz);
    const dur = ev.endTime.getTime() - ev.startTime.getTime();
    if (dur <= 0) {
      return { ...ev, endTime: new Date(ev.startTime.getTime() + 90 * 60 * 1000) };
    }
    if (sk === ek && dur > maxFoodMs) {
      return { ...ev, endTime: new Date(ev.startTime.getTime() + maxFoodMs) };
    }
    if (sk !== ek && dur > 16 * 60 * 60 * 1000) {
      return { ...ev, endTime: new Date(ev.startTime.getTime() + maxFoodMs) };
    }
    return ev;
  });
}

export function enforceDeterministicItineraryRules(
  events: ProposedEventInput[],
  trip: TripContext,
  tz: string,
): ProposedEventInput[] {
  let e = sortByStart(events);
  e = clipEventsToTripDateRange(e, trip, tz);
  e = normalizeProposedEventCategories(e, trip);
  e = dedupeStrictIntercityLegs(e, trip, tz);
  e = repairLocationTitleCityMismatches(e, trip);
  e = repairImpossibleSameCalendarMeals(e, trip, tz);
  e = dropOriginTourismDuringDestinationStay(e, trip, tz);
  e = dropPostReturnDestinationActivities(e, trip);
  return sortByStart(e);
}

export function getDeterministicItineraryIssues(
  events: ProposedEventInput[],
  trip: TripContext,
): string[] {
  const issues: string[] = [];
  const tz = inferPlanningTimezone(trip.toCity, trip.fromCity);
  const sorted = sortByStart(events);
  const { start: tripStart, end: tripEnd } = getTripZonedWallBounds(trip, tz);

  const returns = sorted.filter((e) => isStrictReturnIntercityLeg(e, trip));
  if (returns.length > 1) issues.push("Multiple return intercity travel legs");
  const firstKey = zonedDayKey(trip.fromDate, tz);
  const outbounds = sorted.filter(
    (e) => isStrictOutboundIntercityLeg(e, trip) && zonedDayKey(e.startTime, tz) === firstKey,
  );
  if (outbounds.length > 1) issues.push("Multiple outbound legs on first trip day");

  for (const ev of sorted) {
    if (ev.endTime.getTime() <= ev.startTime.getTime()) {
      issues.push(`"${ev.title}": invalid time range`);
    }
    if (ev.startTime.getTime() < tripStart.getTime() || ev.endTime.getTime() > tripEnd.getTime()) {
      issues.push(`"${ev.title}": outside trip date bounds`);
    }
    const et = (ev.eventType ?? "").toLowerCase();
    if (
      (et === "transport" || et === "travel" || et === "transit") &&
      !isRealIntercityTransportLeg(ev, trip)
    ) {
      issues.push(`"${ev.title}": mislabeled as transport`);
    }
  }

  const returnEnd = returns.length ? Math.max(...returns.map((r) => r.endTime.getTime())) : 0;
  const toTok = mainCityToken(trip.toCity);
  if (returnEnd > 0 && toTok.length >= 3) {
    for (const ev of sorted) {
      if (isRealIntercityTransportLeg(ev, trip)) continue;
      if (ev.startTime.getTime() < returnEnd) continue;
      if (mentionsCityTok(ev, toTok) && !mentionsCityTok(ev, mainCityToken(trip.fromCity))) {
        issues.push(`"${ev.title}": destination activity after return travel`);
      }
    }
  }

  const returnMin = returns.length ? Math.min(...returns.map((r) => r.startTime.getTime())) : Number.POSITIVE_INFINITY;
  for (const ev of sorted) {
    if (isRealIntercityTransportLeg(ev, trip)) continue;
    const k = zonedDayKey(ev.startTime, tz);
    if (k === firstKey) continue;
    if (ev.startTime.getTime() >= returnMin) continue;
    if (isOriginTouristNoise(ev, trip)) {
      issues.push(`"${ev.title}": origin-city tourism during destination stay`);
    }
  }

  return issues;
}

export function mergeItineraryValidationIssues(
  events: ProposedEventInput[],
  trip: TripContext,
  chronologyIssues: string[],
): string[] {
  const det = getDeterministicItineraryIssues(events, trip);
  return [...new Set([...chronologyIssues, ...det])];
}

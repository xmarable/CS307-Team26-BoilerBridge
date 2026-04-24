import type { TripContext } from "@/lib/itinerary/generatePartial";

const TRAVEL_TITLE_RE =
  /\b(travel|transit|commute|shuttle|uber|lyft|taxi|drive|driving|train|bus|flight|fly|flying|airport|depart|en route|return home|heading back)\b/i;

const MOVE_VERB_RE =
  /\b(flights?|flight|fly|flying|train|bus|drive|driving|shuttle|taxi|uber|lyft)\b/i;

export function mainCityToken(city: string): string {
  const part = city.split(",")[0]!.trim().toLowerCase();
  return part.replace(/[^a-z0-9\s]/g, "").trim();
}

export function isInterCityTrip(trip: TripContext): boolean {
  const a = trip.fromCity.trim().toLowerCase();
  const b = trip.toCity.trim().toLowerCase();
  return a.length > 0 && b.length > 0 && a !== b;
}

/**
 * True for explicit intercity movement between trip endpoints (used for ordering).
 * Excludes standalone "arrival" blocks that are not tied to a move verb.
 */
export function isStrictOutboundIntercityLeg(
  ev: { title: string; description?: string; eventType?: string },
  trip: TripContext,
): boolean {
  if (!isInterCityTrip(trip)) return false;
  const blob = `${ev.title} ${ev.description ?? ""}`.toLowerCase();
  const fromTok = mainCityToken(trip.fromCity);
  const toTok = mainCityToken(trip.toCity);
  if (fromTok.length < 3 || toTok.length < 3) return false;
  if (
    /\btravel\b/i.test(blob) &&
    (blob.includes("→") || blob.includes("->")) &&
    blob.includes(fromTok) &&
    blob.includes(toTok)
  ) {
    const fi = blob.indexOf(fromTok);
    const ti = blob.indexOf(toTok);
    if (fi !== -1 && ti !== -1 && fi < ti) return true;
  }
  if (!MOVE_VERB_RE.test(blob)) return false;
  if (!blob.includes(fromTok) || !blob.includes(toTok)) return false;
  const fi = blob.indexOf(fromTok);
  const ti = blob.indexOf(toTok);
  if (fi !== -1 && ti !== -1 && fi < ti) return true;
  if (/\bfrom\b/.test(blob) && blob.includes(fromTok) && blob.includes(toTok)) return true;
  return false;
}

export function isStrictReturnIntercityLeg(
  ev: { title: string; description?: string },
  trip: TripContext,
): boolean {
  if (!isInterCityTrip(trip)) return false;
  const blob = `${ev.title} ${ev.description ?? ""}`.toLowerCase();
  const fromTok = mainCityToken(trip.fromCity);
  const toTok = mainCityToken(trip.toCity);
  if (fromTok.length < 3 || toTok.length < 3) return false;
  if (
    /\btravel\b/i.test(blob) &&
    (blob.includes("→") || blob.includes("->")) &&
    blob.includes(fromTok) &&
    blob.includes(toTok)
  ) {
    const fi = blob.indexOf(fromTok);
    const ti = blob.indexOf(toTok);
    if (fi !== -1 && ti !== -1 && ti < fi) return true;
  }
  if (!MOVE_VERB_RE.test(blob)) return false;
  if (!blob.includes(fromTok) || !blob.includes(toTok)) return false;
  const fi = blob.indexOf(fromTok);
  const ti = blob.indexOf(toTok);
  if (fi !== -1 && ti !== -1 && ti < fi) return true;
  if (/\b(return|returning|heading home|back to)\b/i.test(blob) && blob.includes(fromTok)) {
    return true;
  }
  return false;
}

export function isTravelLikeEvent(ev: {
  title: string;
  eventType?: string;
}): boolean {
  const t = (ev.eventType ?? "").toLowerCase();
  if (t === "travel" || t === "transit" || t === "transport") return true;
  return TRAVEL_TITLE_RE.test(ev.title);
}

export function interCityBlockMs(mode: string): number {
  const m = mode.toLowerCase();
  if (m === "flight") return (3 + 3.5) * 60 * 60 * 1000; // air + airport buffers (heuristic)
  if (m === "train") return 5 * 60 * 60 * 1000;
  if (m === "bus") return 6 * 60 * 60 * 1000;
  if (m === "taxi") return 4 * 60 * 60 * 1000; // long-distance rideshare / car
  return 5 * 60 * 60 * 1000;
}

/** Buffer between consecutive stops in the destination city (no routing APIs). */
export function intraCityTransitionMs(mode: string): number {
  const m = mode.toLowerCase();
  if (m === "flight") return 45 * 60 * 1000;
  if (m === "train") return 35 * 60 * 1000;
  if (m === "bus") return 35 * 60 * 1000;
  if (m === "taxi") return 20 * 60 * 1000;
  return 30 * 60 * 1000;
}

export function maxActivityDurationMs(ev: {
  title: string;
  eventType?: string;
}): number {
  if (isTravelLikeEvent(ev)) return 14 * 60 * 60 * 1000;
  const t = `${ev.eventType ?? ""} ${ev.title}`.toLowerCase();
  if (/\b(arrival|arrive|landed)\b/.test(t) && /\b(airport|terminal)\b/.test(t)) {
    return 3 * 60 * 60 * 1000;
  }
  if (/\b(breakfast|brunch|lunch|dinner|snack|coffee|meal)\b/.test(t)) {
    return 2 * 60 * 60 * 1000;
  }
  if (/\b(museum|gallery|zoo|aquarium|tour)\b/.test(t)) {
    return 4 * 60 * 60 * 1000;
  }
  return 3 * 60 * 60 * 1000;
}

import type { TripContext } from "@/lib/itinerary/generatePartial";

const TRAVEL_TITLE_RE =
  /\b(travel|transit|commute|shuttle|uber|lyft|taxi|drive|driving|train|bus|flight|fly|airport|depart|arrival|en route|return home|heading back)\b/i;

export function isInterCityTrip(trip: TripContext): boolean {
  const a = trip.fromCity.trim().toLowerCase();
  const b = trip.toCity.trim().toLowerCase();
  return a.length > 0 && b.length > 0 && a !== b;
}

export function isTravelLikeEvent(ev: {
  title: string;
  eventType?: string;
}): boolean {
  const t = (ev.eventType ?? "").toLowerCase();
  if (t === "travel" || t === "transit") return true;
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
  if (/\b(breakfast|brunch|lunch|dinner|snack|coffee|meal)\b/.test(t)) {
    return 2 * 60 * 60 * 1000;
  }
  if (/\b(museum|gallery|zoo|aquarium|tour)\b/.test(t)) {
    return 4 * 60 * 60 * 1000;
  }
  return 3 * 60 * 60 * 1000;
}

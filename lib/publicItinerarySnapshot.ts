type TripLean = {
  fromCity: string;
  toCity: string;
  fromDate: Date;
  toDate: Date;
  primaryItinerary?: unknown[];
  rainyDayItinerary?: unknown[];
};

export function buildTripSnapshot(trip: TripLean) {
  return {
    primaryItinerary: trip.primaryItinerary ?? [],
    rainyDayItinerary: trip.rainyDayItinerary ?? [],
    fromCity: trip.fromCity,
    toCity: trip.toCity,
    fromDate: trip.fromDate,
    toDate: trip.toDate,
  };
}

export function buildTitleFromCities(fromCity: string, toCity: string) {
  return `${fromCity} → ${toCity}`;
}

export function formatSubtitleRange(fromDate: Date, toDate: Date) {
  const opts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  const a = new Date(fromDate).toLocaleDateString(undefined, opts);
  const b = new Date(toDate).toLocaleDateString(undefined, opts);
  return `${a} — ${b}`;
}

/** Calendar itinerary events as plain JSON-safe objects */
export function serializeGroupItineraryEvents(events: Record<string, unknown>[]) {
  return events.map((ev) => ({
    title: String(ev.title ?? ""),
    description: ev.description != null ? String(ev.description) : "",
    startTime: ev.startTime,
    endTime: ev.endTime,
    location: ev.location != null ? String(ev.location) : "",
    eventType: ev.eventType != null ? String(ev.eventType) : "general",
  }));
}

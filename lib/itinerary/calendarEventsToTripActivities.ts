import type { TripItineraryActivityPlain } from "@/lib/itinerary/ensureItinerarySectionIds";

type CalendarEventLike = {
  title?: string;
  startTime?: Date | string;
  endTime?: Date | string;
  location?: string;
  eventType?: string;
  description?: string;
};

function inferIsOutdoor(eventType: string): boolean {
  const t = eventType.toLowerCase();
  if (
    t.includes("museum") ||
    t.includes("food") ||
    t.includes("drink") ||
    t.includes("indoor") ||
    t.includes("shopping") ||
    t.includes("spa") ||
    t.includes("theater") ||
    t.includes("theatre")
  ) {
    return false;
  }
  if (
    t.includes("travel") ||
    t.includes("flight") ||
    t.includes("outdoor") ||
    t.includes("park") ||
    t.includes("hike") ||
    t.includes("beach") ||
    t.includes("sightseeing")
  ) {
    return true;
  }
  return eventType === "activity";
}

/**
 * Maps group calendar itinerary events into Trip.embedded activity rows
 * for `primaryItinerary` (overwrite sync).
 */
export function calendarEventsToTripActivities(
  events: CalendarEventLike[],
): TripItineraryActivityPlain[] {
  return events.map((ev) => {
    const eventType = (ev.eventType ?? "general").trim() || "general";
    const name = (ev.title ?? "").trim() || "Untitled activity";
    return {
      name,
      startTime: ev.startTime,
      endTime: ev.endTime,
      location: ev.location?.trim() || undefined,
      category: eventType,
      isOutdoor: inferIsOutdoor(eventType),
    };
  });
}

/** Normalize rainy-day generator output to Trip activity rows (name + category). */
export function normalizeRainyActivitiesForTrip(
  rows: Record<string, unknown>[],
): TripItineraryActivityPlain[] {
  return rows.map((row) => {
    const name = String(row.name ?? row.title ?? "").trim() || "Activity";
    const category = String(row.category ?? row.eventType ?? "general").trim();
    const isOutdoor =
      typeof row.isOutdoor === "boolean" ? row.isOutdoor : false;
    return {
      name,
      startTime: row.startTime as Date | string | undefined,
      endTime: row.endTime as Date | string | undefined,
      location:
        row.location != null ? String(row.location).trim() : undefined,
      category: category || "general",
      isOutdoor,
    };
  });
}

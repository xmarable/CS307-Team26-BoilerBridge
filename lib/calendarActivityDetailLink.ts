/**
 * Deep-link for calendar rows (US15): stored Activity, Google place preview,
 * or text-based preview for Spark/itinerary items without resolved ids.
 */
export type CalendarEventLikeForLink = {
  title: string;
  location?: string;
  linkedActivityId?: string;
  linkedPlaceId?: string;
  source?: "manual" | "itinerary";
  /** From Spark itinerary rows — biases preview / Places resolution */
  itineraryDestinationCity?: string;
};

const MIN_NAME_QUERY_LEN = 2;

function appendDestination(q: URLSearchParams, ev: CalendarEventLikeForLink) {
  const d = ev.itineraryDestinationCity?.trim();
  if (d) q.set("destination", d);
}

export function buildCalendarActivityDetailHref(
  ev: CalendarEventLikeForLink,
): string | undefined {
  const aid = ev.linkedActivityId?.trim();
  if (aid) return `/dashboard/activities/${encodeURIComponent(aid)}`;

  const pid = ev.linkedPlaceId?.trim();
  if (pid) {
    const q = new URLSearchParams();
    q.set("placeId", pid);
    if (ev.title?.trim()) q.set("name", ev.title.trim());
    if (ev.location?.trim()) q.set("address", ev.location.trim());
    appendDestination(q, ev);
    return `/dashboard/activities/preview?${q.toString()}`;
  }

  const title = ev.title?.trim() ?? "";
  if (title.length < MIN_NAME_QUERY_LEN) return undefined;

  if (ev.source !== "itinerary") return undefined;

  const q = new URLSearchParams();
  q.set("name", title);
  if (ev.location?.trim()) q.set("address", ev.location.trim());
  appendDestination(q, ev);
  return `/dashboard/activities/preview?${q.toString()}`;
}

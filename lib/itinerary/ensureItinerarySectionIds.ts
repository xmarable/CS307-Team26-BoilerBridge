import { randomUUID } from "crypto";

export type TripItineraryActivityPlain = {
  activityId?: string;
  itineraryActivityId?: string;
  dayId?: string;
  name?: string;
  startTime?: Date | string;
  endTime?: Date | string;
  isOutdoor?: boolean;
  category?: string;
  location?: string;
};

function dayKeyFromStart(start: Date | string | undefined): string {
  if (start === undefined || start === null) return "unknown-day";
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return "unknown-day";
  return d.toISOString().slice(0, 10);
}

/**
 * Ensures every itinerary row has stable `dayId` and `itineraryActivityId`.
 * Groups by calendar day (UTC date of startTime) so day-wise edits stay coherent.
 */
export function ensureItinerarySectionIds(
  activities: TripItineraryActivityPlain[] | undefined,
): { next: TripItineraryActivityPlain[]; changed: boolean } {
  if (!activities?.length) return { next: [], changed: false };

  const cloned = activities.map((a) => ({ ...a }));
  const groups = new Map<string, TripItineraryActivityPlain[]>();
  for (const act of cloned) {
    const dk = dayKeyFromStart(act.startTime);
    const arr = groups.get(dk) ?? [];
    arr.push(act);
    groups.set(dk, arr);
  }

  let changed = false;
  for (const [, acts] of groups) {
    const existingDayId = acts.find((a) => a.dayId)?.dayId;
    const dayId = existingDayId && existingDayId.length > 0 ? existingDayId : randomUUID();
    if (!existingDayId) changed = true;
    for (const act of acts) {
      if (act.dayId !== dayId) {
        if (act.dayId) changed = true;
        act.dayId = dayId;
      }
      if (!act.itineraryActivityId || act.itineraryActivityId.length === 0) {
        act.itineraryActivityId = randomUUID();
        changed = true;
      }
    }
  }

  return { next: cloned, changed };
}

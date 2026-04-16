import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import { matchesAvoidList } from "@/lib/tripRecommendations";
import { titleMatchesMustHave } from "@/lib/itinerary/resolveActivityLinks";

type MustHaveLike = { name: string };

/**
 * Drops proposed events whose title/location match avoid lists (US14).
 * Events that correspond to an approved must-have are kept.
 */
export function filterProposedEventsByAvoidLists(
  events: ProposedEventInput[],
  avoidActivities: string[],
  avoidLocations: string[],
  mustHaves: MustHaveLike[],
): ProposedEventInput[] {
  if (
    (!avoidActivities || avoidActivities.length === 0) &&
    (!avoidLocations || avoidLocations.length === 0)
  ) {
    return events;
  }
  const acts = avoidActivities ?? [];
  const locs = avoidLocations ?? [];
  return events.filter((ev) => {
    if (mustHaves.some((m) => titleMatchesMustHave(ev.title, m.name))) {
      return true;
    }
    return !matchesAvoidList(ev.title, ev.location, acts, locs);
  });
}

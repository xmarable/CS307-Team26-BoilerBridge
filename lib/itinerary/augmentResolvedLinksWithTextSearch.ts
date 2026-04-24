import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import type { ResolvedActivityLink } from "@/lib/itinerary/resolveActivityLinks";
import { geocodeCityCenter } from "@/lib/travel/geocodeCityCenter";
import { pickBestPlaceHitForDestination } from "@/lib/travel/pickPlaceHitForDestination";
import { searchPlacesText } from "@/lib/travel/googlePlaces";

export type TripLinkContext = {
  toCity: string;
  fromCity?: string;
};

/**
 * For itinerary rows still missing links, run destination-aware Google Text Search
 * (biased + ranked) so US15 preview resolves to the trip city, not a distant chain default.
 */
export async function augmentResolvedLinksWithTextSearch(
  events: ProposedEventInput[],
  linkRows: ResolvedActivityLink[],
  trip?: TripLinkContext | null,
): Promise<ResolvedActivityLink[]> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!key || events.length === 0) return linkRows;

  const dest = trip?.toCity?.trim() ?? "";
  let bias: { latitude: number; longitude: number; radiusMeters: number } | null = null;
  if (dest) {
    const center = await geocodeCityCenter(key, dest);
    if (center) {
      bias = { ...center, radiusMeters: 50000 };
    }
  }

  const out = linkRows.slice();
  for (let i = 0; i < events.length; i++) {
    if (out[i]?.linkedActivityId || out[i]?.linkedPlaceId) continue;
    const ev = events[i]!;
    const title = typeof ev.title === "string" ? ev.title.trim() : "";
    const loc = typeof ev.location === "string" ? ev.location.trim() : "";
    if (title.length < 2) continue;

    const parts: string[] = [title];
    if (loc) parts.push(loc);
    if (dest) {
      const destLower = dest.toLowerCase();
      const alreadyAnchored =
        title.toLowerCase().includes(destLower) ||
        loc.toLowerCase().includes(destLower);
      if (!alreadyAnchored) parts.push(dest);
    }
    const q = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    if (q.length < 3) continue;

    try {
      const hits = await searchPlacesText(key, q, 10, { bias });
      const chosen =
        dest && hits.length > 0
          ? pickBestPlaceHitForDestination(hits, dest)
          : hits[0];
      const pid = chosen?.placeId?.trim();
      if (pid) {
        out[i] = {
          ...out[i],
          linkedPlaceId: pid,
          ...(chosen?.address?.trim()
            ? { linkedLocationHint: chosen.address.trim() }
            : {}),
        };
      }
    } catch {
      /* ignore — optional enrichment */
    }
  }
  return out;
}

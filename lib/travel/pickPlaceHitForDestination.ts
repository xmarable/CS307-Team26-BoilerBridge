import type { GooglePlaceSearchHit } from "@/lib/travel/googlePlaces";

function normCity(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Other major metros (normalized) — penalize when they appear in address but destination differs. */
const OTHER_METRO_ALIASES: string[][] = [
  ["new york", "nyc", "manhattan", "brooklyn", "queens", "bronx"],
  ["los angeles", "hollywood", "santa monica"],
  ["san francisco", "oakland", "berkeley"],
  ["miami", "miami beach"],
  ["seattle"],
  ["boston", "cambridge"],
  ["atlanta"],
  ["denver"],
  ["dallas", "fort worth"],
  ["houston"],
  ["philadelphia"],
  ["washington", "dc"],
];

function metroGroupContainsCity(groups: string[][], cityNorm: string): number {
  for (let i = 0; i < groups.length; i++) {
    if (groups[i]!.some((a) => cityNorm.includes(a) || a.includes(cityNorm))) return i;
  }
  return -1;
}

/**
 * Scores a Places text-search hit for likelihood of being in the trip destination city.
 */
export function scorePlaceHitForDestination(
  hit: GooglePlaceSearchHit,
  destinationCity: string,
): number {
  const dest = normCity(destinationCity);
  if (!dest) return 0;
  const hay = `${hit.name} ${hit.address ?? ""}`.toLowerCase();
  let score = 0;

  if (hay.includes(dest)) score += 12;
  for (const part of dest.split(" ").filter((p) => p.length > 2)) {
    if (hay.includes(part)) score += 3;
  }

  const destGroup = metroGroupContainsCity(OTHER_METRO_ALIASES, dest);
  for (let g = 0; g < OTHER_METRO_ALIASES.length; g++) {
    if (g === destGroup) continue;
    const wrong = OTHER_METRO_ALIASES[g]!;
    for (const token of wrong) {
      if (hay.includes(token) && !hay.includes(dest)) {
        score -= 10;
        break;
      }
    }
  }

  return score;
}

/**
 * Picks the best hit for the destination; prefers in-city matches and avoids obvious wrong metros.
 */
export function pickBestPlaceHitForDestination(
  hits: GooglePlaceSearchHit[],
  destinationCity: string,
): GooglePlaceSearchHit | undefined {
  if (!hits.length) return undefined;
  const dest = normCity(destinationCity);
  if (!dest) return hits[0];

  const scored = hits.map((h) => ({
    h,
    s: scorePlaceHitForDestination(h, dest),
  }));
  scored.sort((a, b) => b.s - a.s);

  const best = scored[0]!;
  const strongInCity = scored.some((x) => x.s >= 8);
  if (strongInCity && best.s < 4) {
    const inCity = scored.find((x) => x.s >= 8);
    if (inCity) return inCity.h;
  }

  if (best.s < -4 && scored.length > 1 && scored[1]!.s > best.s) {
    return scored[1]!.h;
  }

  return best.h;
}

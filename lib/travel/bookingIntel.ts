/**
 * US16: Decide which booking / external actions to show and how to label them.
 * Uses Google `types` when present; never shows a misleading “Book now” without a direct ticket URL.
 */

import { sanitizeHttpsUrl, buildTripadvisorSearchUrl, buildGoogleMapsSearchUrl } from "@/lib/safeExternalUrl";
import { buildExpediaHotelSearchUrl } from "@/lib/travel/expediaRapid";

export type BookingPlanMode = "direct" | "lodging_nearby" | "explore";

export type BookingPlanAction = {
  id: string;
  label: string;
  description?: string;
  url: string;
  kind: "book" | "search" | "maps" | "official" | "reviews";
};

export type BookingPlan = {
  mode: BookingPlanMode;
  /** Short guidance above the buttons */
  headline: string;
  subline?: string;
  /** Shown at top of the booking card */
  bookingNote?: string;
  primary?: BookingPlanAction;
  secondaries: BookingPlanAction[];
};

const OUTDOOR_FREE = new Set([
  "park",
  "natural_feature",
  "hiking_area",
  "national_park",
  "playground",
]);
const LODGING = new Set(["lodging", "hotel"]);
const FOOD = new Set(["restaurant", "cafe", "bar", "bakery", "meal_delivery", "meal_takeaway"]);

function normalizeTypes(types: string[] | null | undefined): string[] {
  if (!Array.isArray(types)) return [];
  return types.map((t) => String(t).toLowerCase()).filter(Boolean);
}

function typesIntersect(types: string[], set: Set<string>): boolean {
  return types.some((t) => set.has(t));
}

export function deriveHintTags(types: string[] | null | undefined): string[] {
  const t = normalizeTypes(types);
  const tags: string[] = [];
  if (typesIntersect(t, OUTDOOR_FREE)) tags.push("Outdoors");
  if (typesIntersect(t, new Set(["museum", "art_gallery", "tourist_attraction"]))) {
    tags.push("Sightseeing");
  }
  if (typesIntersect(t, FOOD)) tags.push("Food & drink");
  if (typesIntersect(t, LODGING)) tags.push("Lodging");
  if (typesIntersect(t, new Set(["night_club", "bar"]))) tags.push("Nightlife");
  if (typesIntersect(t, new Set(["gym", "spa"]))) tags.push("Wellness");
  return [...new Set(tags)].slice(0, 5);
}

function destinationForSearch(name: string, address?: string | null): string {
  return [name, address].filter(Boolean).join(" ").trim() || name;
}

/**
 * @param expediaUrl — resolved URL (manual, Rapid property, or hotel-search fallback)
 * @param expediaSource — from Expedia resolution
 */
export function buildBookingPlan(args: {
  name: string;
  address?: string | null;
  infoUrl?: string | null;
  manualBookingUrl?: string | null;
  googleMapsUri?: string | null;
  googleTypes?: string[] | null;
  expediaUrl: string;
  expediaSource: "manual" | "rapid-property" | "hotel-search-fallback";
}): BookingPlan {
  const types = normalizeTypes(args.googleTypes);
  const outdoorWalkup = typesIntersect(types, OUTDOOR_FREE);
  const isLodging = typesIntersect(types, LODGING);
  const searchDest = destinationForSearch(args.name, args.address);

  const tripAdvisor = buildTripadvisorSearchUrl(searchDest);
  const mapsSearchFallback = buildGoogleMapsSearchUrl(searchDest);
  const official = sanitizeHttpsUrl(args.infoUrl);
  const mapsDirect = sanitizeHttpsUrl(args.googleMapsUri);
  const expediaSafe = sanitizeHttpsUrl(args.expediaUrl);

  const pushUnique = (list: BookingPlanAction[], a: BookingPlanAction | null) => {
    if (!a) return;
    if (list.some((x) => x.url === a.url)) return;
    list.push(a);
  };

  const buildCommonSecondaries = (): BookingPlanAction[] => {
    const list: BookingPlanAction[] = [];
    if (official) {
      pushUnique(list, {
        id: "official",
        label: "Official website",
        url: official,
        kind: "official",
        description: "Hours, tickets, and updates from the venue",
      });
    }
    if (tripAdvisor) {
      pushUnique(list, {
        id: "tripadvisor",
        label: "Search on Tripadvisor",
        url: tripAdvisor,
        kind: "reviews",
        description: "Traveller reviews and photos",
      });
    }
    if (mapsDirect) {
      pushUnique(list, {
        id: "maps_place",
        label: "Open in Google Maps",
        url: mapsDirect,
        kind: "maps",
      });
    } else if (mapsSearchFallback) {
      pushUnique(list, {
        id: "maps_search",
        label: "Search in Google Maps",
        url: mapsSearchFallback,
        kind: "maps",
      });
    }
    return list;
  };

  const manual = sanitizeHttpsUrl(args.manualBookingUrl);
  if (manual) {
    return {
      mode: "direct",
      headline: "Book tickets or a time slot",
      subline:
        "You will leave BoilerBridge. Always confirm prices and cancellation terms on the vendor site.",
      primary: {
        id: "direct",
        label: "Book now",
        url: manual,
        kind: "book",
      },
      secondaries: dedupeSecondaries(buildCommonSecondaries()),
    };
  }

  if (outdoorWalkup && !isLodging) {
    const secs = buildCommonSecondaries();
    if (expediaSafe && args.expediaSource === "hotel-search-fallback") {
      pushUnique(secs, {
        id: "expedia_hotels",
        label: "Find nearby hotels on Expedia",
        url: expediaSafe,
        kind: "search",
        description: "Stays near this area",
      });
    }
    return {
      mode: "explore",
      headline: "Plan your visit",
      bookingNote:
        "Outdoor and many public places do not need a “booking” in the app sense — check local rules and hours before you go.",
      subline: "Use maps and official sources to confirm access, parking, and fees.",
      secondaries: dedupeSecondaries(secs),
    };
  }

  if (isLodging && expediaSafe) {
    const label =
      args.expediaSource === "rapid-property"
        ? "View rate on Expedia"
        : "Search hotels on Expedia";
    return {
      mode: "lodging_nearby",
      headline: "Stays and rates",
      subline:
        "Lodging links open Expedia. BoilerBridge does not run checkout — verify details before you pay.",
      primary: {
        id: "expedia",
        label,
        url: expediaSafe,
        kind: args.expediaSource === "rapid-property" ? "book" : "search",
      },
      secondaries: dedupeSecondaries(buildCommonSecondaries()),
    };
  }

  const exploreSecs = buildCommonSecondaries();
  if (expediaSafe) {
    pushUnique(exploreSecs, {
      id: "expedia_hotels",
      label: "Search stays on Expedia",
      url: expediaSafe,
      kind: "search",
      description: "Hotels and vacation rentals near this destination",
    });
  }

  return {
    mode: "explore",
    headline: "Explore & book elsewhere",
    subline:
      "No direct ticket link is stored for this place. Use the options below to plan your visit.",
    secondaries: dedupeSecondaries(exploreSecs),
  };
}

function dedupeSecondaries(actions: BookingPlanAction[]): BookingPlanAction[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

/** When no Rapid keys: still expose Expedia hotel search URL for plans. */
export function defaultExpediaSearchUrl(name: string, address?: string | null): string {
  return buildExpediaHotelSearchUrl(destinationForSearch(name, address));
}

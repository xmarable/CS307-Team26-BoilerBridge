/**
 * Google Places — US15 enrichment.
 * Tries Places API (New) first; falls back to legacy maps.googleapis.com endpoints
 * when the New API is disabled (403 SERVICE_DISABLED), which is common if only
 * “Places API” (classic) was enabled in GCP.
 * https://developers.google.com/maps/documentation/places/web-service/place-details
 */

const PLACES_DETAIL = "https://places.googleapis.com/v1/places";
const PLACES_SEARCH = "https://places.googleapis.com/v1/places:searchText";

/** Full data — must be requested via Place Details, not Text Search. */
const DETAIL_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "rating",
  "userRatingCount",
  "reviews",
  "websiteUri",
  "googleMapsUri",
  "editorialSummary",
  "types",
  "priceLevel",
  "nationalPhoneNumber",
  "regularOpeningHours",
  "photos",
].join(",");

/**
 * Text Search (New) only supports a subset of fields; requesting reviews/editorial
 * etc. on search often returns 400 and we got no enrichment at all.
 */
const SEARCH_FIELD_MASK_MIN = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
].join(",");

/** Text Search (New): richer mask for browse/discovery (falls back to MIN on 400). */
const SEARCH_FIELD_MASK_BROWSE = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.types",
].join(",");

const fetchOpts: RequestInit = {
  cache: "no-store",
};

export type GooglePlaceReview = {
  text: string;
  rating: number;
  author?: string;
};

export type GooglePlaceEnrichment = {
  placeId: string;
  displayName?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  reviews: GooglePlaceReview[];
  websiteUri?: string;
  googleMapsUri?: string;
  editorialSummary?: string;
  types?: string[];
  /** Normalized 0–4 when available (legacy numeric or New enum mapped). */
  priceLevel?: number;
  nationalPhoneNumber?: string;
  weekdayDescriptions?: string[];
  /** Legacy Place Photo API */
  googlePhotoReference?: string;
  /** Places API (New) photo resource name, e.g. places/ChIJ…/photos/… */
  googlePhotoMediaResource?: string;
};

function normalizePlaceId(raw: string | undefined | null): string | null {
  const s = raw?.trim();
  if (!s) return null;
  if (s.startsWith("places/")) return s.slice("places/".length).trim() || null;
  return s;
}

const LEGACY_TEXTSEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";
const LEGACY_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json";
const LEGACY_DETAIL_FIELDS =
  "place_id,name,formatted_address,rating,user_ratings_total,reviews,website,url,editorial_summary,types,price_level,formatted_phone_number,opening_hours,photos";

/** New API disabled / not enabled for project — same key often works on legacy. */
function shouldFallbackToLegacyPlaces(errorBody: string): boolean {
  return (
    errorBody.includes("SERVICE_DISABLED") ||
    errorBody.includes("Places API (New)") ||
    (errorBody.includes("places.googleapis.com") && errorBody.includes("disabled"))
  );
}

function mapLegacyDetailsToEnrichment(
  result: Record<string, unknown>,
  placeId: string,
): GooglePlaceEnrichment {
  const reviewsRaw = Array.isArray(result.reviews) ? result.reviews : [];
  const reviews: GooglePlaceReview[] = reviewsRaw
    .slice(0, 8)
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const text = typeof o.text === "string" ? o.text.trim() : "";
      const rating = typeof o.rating === "number" ? o.rating : Number(o.rating) || 0;
      const author =
        typeof o.author_name === "string" && o.author_name.trim()
          ? o.author_name.trim()
          : undefined;
      if (!text) return null;
      return { text, rating, author };
    })
    .filter(Boolean) as GooglePlaceReview[];

  let editorialSummary: string | undefined;
  const es = result.editorial_summary;
  if (es && typeof es === "object") {
    const overview = (es as { overview?: unknown }).overview;
    if (typeof overview === "string" && overview.trim()) {
      editorialSummary = overview.trim();
    }
  }

  const types = Array.isArray(result.types)
    ? result.types.filter((t): t is string => typeof t === "string")
    : undefined;
  const priceLevel =
    typeof result.price_level === "number" ? result.price_level : undefined;
  const nationalPhoneNumber =
    typeof result.formatted_phone_number === "string"
      ? result.formatted_phone_number.trim()
      : undefined;
  let weekdayDescriptions: string[] | undefined;
  const oh = result.opening_hours;
  if (oh && typeof oh === "object") {
    const wt = (oh as { weekday_text?: unknown }).weekday_text;
    if (Array.isArray(wt)) {
      weekdayDescriptions = wt
        .filter((l): l is string => typeof l === "string" && l.trim().length > 0)
        .map((l) => l.trim());
    }
  }
  let googlePhotoReference: string | undefined;
  const photos = result.photos;
  if (Array.isArray(photos) && photos[0] && typeof photos[0] === "object") {
    const pr = (photos[0] as { photo_reference?: unknown }).photo_reference;
    if (typeof pr === "string" && pr.trim()) googlePhotoReference = pr.trim();
  }

  return {
    placeId,
    displayName: typeof result.name === "string" ? result.name.trim() : undefined,
    formattedAddress:
      typeof result.formatted_address === "string"
        ? result.formatted_address.trim()
        : undefined,
    rating: typeof result.rating === "number" ? result.rating : undefined,
    userRatingCount:
      typeof result.user_ratings_total === "number"
        ? result.user_ratings_total
        : undefined,
    reviews,
    websiteUri:
      typeof result.website === "string" && result.website.startsWith("http")
        ? result.website
        : undefined,
    googleMapsUri:
      typeof result.url === "string" && result.url.startsWith("http")
        ? result.url
        : undefined,
    editorialSummary,
    types,
    priceLevel,
    nationalPhoneNumber,
    weekdayDescriptions,
    googlePhotoReference,
  };
}

async function legacyPlaceDetails(
  apiKey: string,
  placeId: string,
): Promise<GooglePlaceEnrichment | null> {
  const id = normalizePlaceId(placeId);
  if (!id) return null;

  const u = new URL(LEGACY_DETAILS);
  u.searchParams.set("place_id", id);
  u.searchParams.set("fields", LEGACY_DETAIL_FIELDS);
  u.searchParams.set("key", apiKey);

  const res = await fetch(u.toString(), fetchOpts);
  const json = (await res.json()) as {
    status: string;
    result?: Record<string, unknown>;
    error_message?: string;
  };

  if (json.status !== "OK" || !json.result) {
    console.error(
      "[Google Places Legacy] details:",
      json.status,
      json.error_message ?? "",
    );
    return null;
  }

  return mapLegacyDetailsToEnrichment(json.result, id);
}

async function legacyTextSearchThenDetails(
  apiKey: string,
  textQuery: string,
): Promise<GooglePlaceEnrichment | null> {
  const u = new URL(LEGACY_TEXTSEARCH);
  u.searchParams.set("query", textQuery);
  u.searchParams.set("key", apiKey);

  const sRes = await fetch(u.toString(), fetchOpts);
  const sJson = (await sRes.json()) as {
    status: string;
    results?: { place_id?: string }[];
    error_message?: string;
  };

  if (sJson.status !== "OK" || !sJson.results?.[0]?.place_id) {
    console.error(
      "[Google Places Legacy] textsearch:",
      sJson.status,
      sJson.error_message ?? "",
    );
    return null;
  }

  return legacyPlaceDetails(apiKey, sJson.results[0].place_id!);
}

function extractPlaceIdFromSearchHit(place: Record<string, unknown>): string | null {
  const rawId =
    (typeof place.id === "string" && place.id.trim()) ||
    (typeof place.name === "string"
      ? place.name.replace(/^places\//, "").trim()
      : "");
  return normalizePlaceId(rawId);
}

function localizedText(v: unknown): string | undefined {
  if (v && typeof v === "object" && "text" in v) {
    const t = (v as { text?: unknown }).text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return undefined;
}

function mapNewPriceLevel(raw: unknown): number | undefined {
  if (typeof raw === "number" && raw >= 0 && raw <= 4) return raw;
  if (typeof raw === "string") {
    const m: Record<string, number> = {
      PRICE_LEVEL_FREE: 0,
      PRICE_LEVEL_INEXPENSIVE: 1,
      PRICE_LEVEL_MODERATE: 2,
      PRICE_LEVEL_EXPENSIVE: 3,
      PRICE_LEVEL_VERY_EXPENSIVE: 4,
    };
    const n = m[raw];
    if (n !== undefined) return n;
  }
  return undefined;
}

function parsePlaceObject(place: Record<string, unknown>): GooglePlaceEnrichment | null {
  const id = extractPlaceIdFromSearchHit(place);
  if (!id) return null;

  const reviewsRaw = Array.isArray(place.reviews) ? place.reviews : [];
  const reviews: GooglePlaceReview[] = reviewsRaw
    .slice(0, 8)
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const text = localizedText(o.text) ?? "";
      const rating = typeof o.rating === "number" ? o.rating : Number(o.rating) || 0;
      let author: string | undefined;
      const attr = o.authorAttribution;
      if (attr && typeof attr === "object") {
        const d = (attr as Record<string, unknown>).displayName;
        if (typeof d === "string" && d.trim()) author = d.trim();
      }
      if (!text.trim()) return null;
      return { text: text.trim(), rating, author };
    })
    .filter(Boolean) as GooglePlaceReview[];

  const types = Array.isArray(place.types)
    ? place.types.filter((x): x is string => typeof x === "string")
    : undefined;
  const priceLevel = mapNewPriceLevel(place.priceLevel);
  const nationalPhoneNumber =
    typeof place.nationalPhoneNumber === "string"
      ? place.nationalPhoneNumber.trim()
      : undefined;
  let weekdayDescriptions: string[] | undefined;
  const roh =
    (place.regularOpeningHours as Record<string, unknown> | undefined) ??
    (place.currentOpeningHours as Record<string, unknown> | undefined);
  if (roh && Array.isArray(roh.weekdayDescriptions)) {
    weekdayDescriptions = roh.weekdayDescriptions.filter(
      (x): x is string => typeof x === "string" && x.trim().length > 0,
    );
  }
  let googlePhotoMediaResource: string | undefined;
  const photosArr = place.photos;
  if (Array.isArray(photosArr) && photosArr[0] && typeof photosArr[0] === "object") {
    const p0 = photosArr[0] as Record<string, unknown>;
    if (typeof p0.name === "string" && p0.name.includes("photos")) {
      googlePhotoMediaResource = p0.name.trim();
    }
  }

  return {
    placeId: id,
    displayName: localizedText(place.displayName),
    formattedAddress:
      typeof place.formattedAddress === "string" ? place.formattedAddress.trim() : undefined,
    rating: typeof place.rating === "number" ? place.rating : undefined,
    userRatingCount:
      typeof place.userRatingCount === "number" ? place.userRatingCount : undefined,
    reviews,
    websiteUri:
      typeof place.websiteUri === "string" && place.websiteUri.startsWith("http")
        ? place.websiteUri
        : undefined,
    googleMapsUri:
      typeof place.googleMapsUri === "string" && place.googleMapsUri.startsWith("http")
        ? place.googleMapsUri
        : undefined,
    editorialSummary: localizedText(place.editorialSummary),
    types,
    priceLevel,
    nationalPhoneNumber,
    weekdayDescriptions,
    googlePhotoMediaResource,
  };
}

async function placeDetails(
  apiKey: string,
  placeId: string,
): Promise<GooglePlaceEnrichment | null> {
  const id = normalizePlaceId(placeId);
  if (!id) return null;

  const url = `${PLACES_DETAIL}/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    ...fetchOpts,
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAIL_FIELD_MASK,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (shouldFallbackToLegacyPlaces(body)) {
      console.warn(
        "[Google Places] Place Details (New) unavailable; using legacy details API.",
      );
      return legacyPlaceDetails(apiKey, id);
    }
    console.error(
      "[Google Places] Place Details failed:",
      res.status,
      body.slice(0, 500),
    );
    return null;
  }

  const json = (await res.json()) as Record<string, unknown>;
  return parsePlaceObject(json);
}

/**
 * Text search returns top match place id, then Place Details fills reviews, links, summary.
 */
async function textSearchThenDetails(
  apiKey: string,
  textQuery: string,
): Promise<GooglePlaceEnrichment | null> {
  const q = textQuery.trim();
  if (!q) return null;

  const res = await fetch(PLACES_SEARCH, {
    ...fetchOpts,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK_MIN,
    },
    body: JSON.stringify({ textQuery: q, languageCode: "en" }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (shouldFallbackToLegacyPlaces(body)) {
      console.warn(
        "[Google Places] Text Search (New) disabled in GCP — using legacy textsearch + details.",
      );
      return legacyTextSearchThenDetails(apiKey, q);
    }
    console.error(
      "[Google Places] searchText failed:",
      res.status,
      body.slice(0, 800),
      "| If 403: enable Places API (New) OR classic Places API + billing. Server key: IP/none, not HTTP referrer.",
    );
    return null;
  }

  const json = (await res.json()) as Record<string, unknown>;
  const places = Array.isArray(json.places) ? json.places : [];
  const first = places[0];
  if (!first || typeof first !== "object") {
    console.warn("[Google Places] searchText returned no places for:", q);
    return null;
  }

  const hit = first as Record<string, unknown>;
  const placeId = extractPlaceIdFromSearchHit(hit);
  if (!placeId) {
    console.warn("[Google Places] search hit missing place id", hit);
    return null;
  }

  const full = await placeDetails(apiKey, placeId);
  if (full) return full;

  const partial = parsePlaceObject(hit);
  return partial;
}

export type GooglePlaceSearchHit = {
  placeId: string;
  name: string;
  address?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
};

function parseSearchHitFromNew(place: Record<string, unknown>): GooglePlaceSearchHit | null {
  const placeId = extractPlaceIdFromSearchHit(place);
  if (!placeId) return null;
  const name =
    localizedText(place.displayName) ||
    (typeof place.displayName === "string" ? place.displayName.trim() : "") ||
    "Place";
  const address =
    typeof place.formattedAddress === "string" ? place.formattedAddress.trim() : undefined;
  const rating = typeof place.rating === "number" ? place.rating : undefined;
  const userRatingCount =
    typeof place.userRatingCount === "number" ? place.userRatingCount : undefined;
  const types = Array.isArray(place.types)
    ? place.types.filter((t): t is string => typeof t === "string")
    : undefined;
  return { placeId, name, address, rating, userRatingCount, types };
}

async function legacyTextSearchMulti(
  apiKey: string,
  textQuery: string,
  maxResults: number,
): Promise<GooglePlaceSearchHit[]> {
  const u = new URL(LEGACY_TEXTSEARCH);
  u.searchParams.set("query", textQuery.trim());
  u.searchParams.set("key", apiKey);

  const res = await fetch(u.toString(), fetchOpts);
  const json = (await res.json()) as {
    status: string;
    results?: Record<string, unknown>[];
    error_message?: string;
  };

  if (json.status !== "OK" || !Array.isArray(json.results)) {
    console.error(
      "[Google Places Legacy] textsearch multi:",
      json.status,
      json.error_message ?? "",
    );
    return [];
  }

  const out: GooglePlaceSearchHit[] = [];
  for (const r of json.results.slice(0, maxResults)) {
    const pid = typeof r.place_id === "string" ? r.place_id.trim() : "";
    if (!pid) continue;
    const name = typeof r.name === "string" ? r.name.trim() : "Place";
    const address =
      typeof r.formatted_address === "string" ? r.formatted_address.trim() : undefined;
    const rating = typeof r.rating === "number" ? r.rating : undefined;
    const userRatingCount =
      typeof r.user_ratings_total === "number" ? r.user_ratings_total : undefined;
    const types = Array.isArray(r.types)
      ? r.types.filter((t): t is string => typeof t === "string")
      : undefined;
    out.push({ placeId: pid, name, address, rating, userRatingCount, types });
  }
  return out;
}

async function newTextSearchMulti(
  apiKey: string,
  textQuery: string,
  maxResults: number,
): Promise<GooglePlaceSearchHit[]> {
  const q = textQuery.trim();
  if (!q) return [];

  const post = async (fieldMask: string) => {
    return fetch(PLACES_SEARCH, {
      ...fetchOpts,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify({ textQuery: q, languageCode: "en" }),
    });
  };

  let res = await post(SEARCH_FIELD_MASK_BROWSE);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (shouldFallbackToLegacyPlaces(body)) {
      return legacyTextSearchMulti(apiKey, q, maxResults);
    }
    if (res.status === 400) {
      res = await post(SEARCH_FIELD_MASK_MIN);
    }
    if (!res.ok) {
      console.error(
        "[Google Places] searchText (browse) failed:",
        res.status,
        (await res.text().catch(() => "")).slice(0, 400),
      );
      return [];
    }
  }

  const json = (await res.json()) as Record<string, unknown>;
  const places = Array.isArray(json.places) ? json.places : [];
  const out: GooglePlaceSearchHit[] = [];
  for (const p of places.slice(0, maxResults)) {
    if (!p || typeof p !== "object") continue;
    const hit = parseSearchHitFromNew(p as Record<string, unknown>);
    if (hit) out.push(hit);
  }
  return out;
}

/**
 * Multiple text-search hits for discovery UI (no Place Details round-trip per row).
 */
export async function searchPlacesText(
  apiKey: string | undefined | null,
  textQuery: string,
  maxResults = 8,
): Promise<GooglePlaceSearchHit[]> {
  const key = apiKey?.trim();
  const q = textQuery.trim();
  if (!key || q.length < 2) return [];
  const cap = Math.min(Math.max(maxResults, 1), 12);
  return newTextSearchMulti(key, q, cap);
}

/** Build a Google image URL for server-side fetch only (API key as query param). */
export function buildGooglePlacePhotoUpstreamUrl(
  refs: {
    googlePhotoMediaResource?: string | null;
    googlePhotoReference?: string | null;
  },
  apiKey: string,
): string | null {
  const k = apiKey.trim();
  if (!k) return null;
  const media = refs.googlePhotoMediaResource?.trim();
  const ref = refs.googlePhotoReference?.trim();
  if (media) {
    const path = media.replace(/^\//, "");
    const u = new URL(`${path}/media`, "https://places.googleapis.com/v1/");
    u.searchParams.set("maxHeightPx", "900");
    u.searchParams.set("maxWidthPx", "1400");
    u.searchParams.set("key", k);
    return u.toString();
  }
  if (ref) {
    const u = new URL("https://maps.googleapis.com/maps/api/place/photo");
    u.searchParams.set("maxwidth", "1200");
    u.searchParams.set("photo_reference", ref);
    u.searchParams.set("key", k);
    return u.toString();
  }
  return null;
}

/**
 * Load POI summary + reviews using a stored Google Place ID, or text search.
 */
export async function fetchGooglePlaceEnrichment(
  apiKey: string,
  options: {
    placeId?: string | null;
    fallbackTextQuery?: string | null;
  },
): Promise<GooglePlaceEnrichment | null> {
  const key = apiKey.trim();
  if (!key) {
    console.warn("[Google Places] GOOGLE_MAPS_API_KEY is empty — skipping enrichment.");
    return null;
  }

  const normalized = normalizePlaceId(options.placeId ?? null);
  if (normalized) {
    return placeDetails(key, normalized);
  }

  if (options.fallbackTextQuery?.trim()) {
    return textSearchThenDetails(key, options.fallbackTextQuery.trim());
  }

  return null;
}

/** Fields safe to persist when creating an activity from a free-text query. */
export type ResolvedPlaceFieldsForDb = {
  placeId: string;
  address?: string;
  description?: string;
  infoUrl?: string;
  googleMapsUri?: string;
  googleDisplayName?: string;
  googleTypes?: string[];
  priceLevel?: number;
  phoneNumber?: string;
  openingHoursSummary?: string;
  googlePhotoReference?: string;
  googlePhotoMediaResource?: string;
};

export async function resolvePlaceFieldsForCreate(
  apiKey: string | undefined,
  query: { name: string; address?: string },
): Promise<Partial<ResolvedPlaceFieldsForDb>> {
  const key = apiKey?.trim();
  if (!key) {
    console.warn("[Google Places] No GOOGLE_MAPS_API_KEY on server — create saves user text only.");
    return {};
  }

  const textQuery = [query.name?.trim(), query.address?.trim()]
    .filter(Boolean)
    .join(", ");
  if (!textQuery) return {};

  const g = await fetchGooglePlaceEnrichment(key, {
    placeId: null,
    fallbackTextQuery: textQuery,
  });
  if (!g) return {};

  return {
    placeId: g.placeId,
    address: g.formattedAddress,
    description: g.editorialSummary,
    infoUrl: g.websiteUri,
    googleMapsUri: g.googleMapsUri,
    googleDisplayName: g.displayName,
    googleTypes: g.types,
    priceLevel: g.priceLevel,
    phoneNumber: g.nationalPhoneNumber,
    openingHoursSummary: g.weekdayDescriptions?.length
      ? g.weekdayDescriptions.join("\n")
      : undefined,
    googlePhotoReference: g.googlePhotoReference,
    googlePhotoMediaResource: g.googlePhotoMediaResource,
  };
}

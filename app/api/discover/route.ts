import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { geocodeCityCenter } from "@/lib/travel/geocodeCityCenter";

const PLACES_SEARCH = "https://places.googleapis.com/v1/places:searchText";
const LEGACY_TEXTSEARCH =
  "https://maps.googleapis.com/maps/api/place/textsearch/json";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.regularOpeningHours",
  "places.googleMapsUri",
].join(",");

export type StorageLocation = {
  id: string;
  name: string;
  address: string;
  rating?: number;
  reviewCount?: number;
  hours: string;
  distance: string;
  googleMapsUri?: string;
  verified: boolean;
  lat?: number;
  lng?: number;
};

function haversineDistanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function localizedName(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (v && typeof v === "object" && "text" in v) {
    const t = (v as { text?: unknown }).text;
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return undefined;
}

function todaysHoursFromWeekdayDescriptions(
  descs: unknown,
): string | undefined {
  if (!Array.isArray(descs) || descs.length === 0) return undefined;
  // getDay() returns 0=Sunday; Google weekday_descriptions is Mon=0 (new API) or Mon=0 (legacy)
  // Places API (New): index 0 = Monday. JS getDay(): 0=Sun,1=Mon,...6=Sat
  const jsDay = new Date().getDay(); // 0=Sun
  const googleIdx = jsDay === 0 ? 6 : jsDay - 1; // convert to Mon=0
  const raw = descs[googleIdx] ?? descs[0];
  if (typeof raw !== "string") return undefined;
  // Strip day name prefix, e.g. "Monday: 9:00 AM – 9:00 PM" → "9:00 AM – 9:00 PM"
  return raw.replace(/^[^:]+:\s*/, "").trim() || undefined;
}

function mapNewPlace(
  p: Record<string, unknown>,
  i: number,
  center: { latitude: number; longitude: number } | null,
): StorageLocation {
  const name = localizedName(p.displayName) ?? `Storage location ${i + 1}`;
  const address =
    typeof p.formattedAddress === "string" ? p.formattedAddress.trim() : "";
  const rating = typeof p.rating === "number" ? p.rating : undefined;
  const reviewCount =
    typeof p.userRatingCount === "number" ? p.userRatingCount : undefined;
  const googleMapsUri =
    typeof p.googleMapsUri === "string" ? p.googleMapsUri : undefined;

  const roh = p.regularOpeningHours as
    | { weekdayDescriptions?: unknown }
    | undefined;
  const hours =
    todaysHoursFromWeekdayDescriptions(roh?.weekdayDescriptions) ??
    "Hours vary";

  let distance = "–";
  const loc = p.location as
    | { latitude?: number; longitude?: number }
    | undefined;
  if (
    center &&
    loc &&
    typeof loc.latitude === "number" &&
    typeof loc.longitude === "number"
  ) {
    const d = haversineDistanceMiles(
      center.latitude,
      center.longitude,
      loc.latitude,
      loc.longitude,
    );
    distance = `${d.toFixed(1)} mi`;
  }

  return {
    id: typeof p.id === "string" ? p.id : `place-${i}`,
    name,
    address,
    rating,
    reviewCount,
    hours,
    distance,
    googleMapsUri,
    verified: true,
    lat: loc?.latitude,
    lng: loc?.longitude,
  };
}

async function searchLuggageStorageLegacy(
  apiKey: string,
  city: string,
  center: { latitude: number; longitude: number } | null,
): Promise<StorageLocation[]> {
  const u = new URL(LEGACY_TEXTSEARCH);
  u.searchParams.set("query", `luggage storage near ${city}`);
  u.searchParams.set("key", apiKey);
  if (center) {
    u.searchParams.set("location", `${center.latitude},${center.longitude}`);
    u.searchParams.set("radius", "30000");
  }

  const res = await fetch(u.toString(), { cache: "no-store" });
  const json = (await res.json()) as {
    status: string;
    results?: Record<string, unknown>[];
  };

  if (json.status !== "OK" || !Array.isArray(json.results)) return [];

  return json.results.slice(0, 8).map((r, i) => {
    const name =
      typeof r.name === "string" ? r.name.trim() : `Storage location ${i + 1}`;
    const address =
      typeof r.formatted_address === "string"
        ? r.formatted_address.trim()
        : city;
    const rating = typeof r.rating === "number" ? r.rating : undefined;
    const reviewCount =
      typeof r.user_ratings_total === "number"
        ? r.user_ratings_total
        : undefined;
    const googleMapsUri =
      typeof r.url === "string" && r.url.startsWith("http") ? r.url : undefined;

    const oh = r.opening_hours as
      | { weekday_text?: unknown[] }
      | undefined;
    const hours =
      todaysHoursFromWeekdayDescriptions(oh?.weekday_text) ?? "Hours vary";

    let distance = "–";
    const geo = (r.geometry as { location?: { lat?: number; lng?: number } })
      ?.location;
    if (
      center &&
      geo &&
      typeof geo.lat === "number" &&
      typeof geo.lng === "number"
    ) {
      const d = haversineDistanceMiles(
        center.latitude,
        center.longitude,
        geo.lat,
        geo.lng,
      );
      distance = `${d.toFixed(1)} mi`;
    }

    return {
      id: typeof r.place_id === "string" ? r.place_id : `place-${i}`,
      name,
      address,
      rating,
      reviewCount,
      hours,
      distance,
      googleMapsUri,
      verified: true,
      lat: geo?.lat,
      lng: geo?.lng,
    };
  });
}

async function searchLuggageStorage(
  apiKey: string,
  city: string,
  center: { latitude: number; longitude: number } | null,
): Promise<StorageLocation[]> {
  const body: Record<string, unknown> = {
    textQuery: `luggage storage ${city}`,
    languageCode: "en",
    maxResultCount: 8,
  };
  if (center) {
    body.locationBias = {
      circle: {
        center: { latitude: center.latitude, longitude: center.longitude },
        radius: 30000,
      },
    };
  }

  const res = await fetch(PLACES_SEARCH, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (
      text.includes("SERVICE_DISABLED") ||
      text.includes("Places API (New)") ||
      text.includes("disabled")
    ) {
      console.warn("[discover] Places (New) unavailable — using legacy API");
      return searchLuggageStorageLegacy(apiKey, city, center);
    }
    console.error("[discover] Places search failed:", res.status, text.slice(0, 400));
    return [];
  }

  const json = (await res.json()) as { places?: Record<string, unknown>[] };
  const places = Array.isArray(json.places) ? json.places : [];
  return places.map((p, i) => mapNewPlace(p, i, center));
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const city = new URL(req.url).searchParams.get("city")?.trim();
  if (!city)
    return NextResponse.json(
      { error: "city parameter is required" },
      { status: 400 },
    );

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    console.warn("[discover] GOOGLE_MAPS_API_KEY not set");
    return NextResponse.json(
      { error: "Bag storage search is not configured on this server." },
      { status: 503 },
    );
  }

  try {
    const center = await geocodeCityCenter(apiKey, city);
    const locations = await searchLuggageStorage(apiKey, city, center);
    return NextResponse.json({ locations });
  } catch (err) {
    console.error("[discover] Error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

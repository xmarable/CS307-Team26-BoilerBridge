/**
 * Geocode a city label to a lat/lng for Places Text Search location bias.
 * Uses the Geocoding API (same GOOGLE_MAPS_API_KEY as Places).
 */
export async function geocodeCityCenter(
  apiKey: string,
  cityLabel: string,
): Promise<{ latitude: number; longitude: number } | null> {
  const k = apiKey?.trim();
  const q = cityLabel?.trim();
  if (!k || !q) return null;

  const u = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  u.searchParams.set("address", q);
  u.searchParams.set("key", k);

  try {
    const res = await fetch(u.toString(), { cache: "no-store" });
    const json = (await res.json()) as {
      status?: string;
      results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
    };
    if (json.status !== "OK" || !Array.isArray(json.results) || json.results.length === 0) {
      return null;
    }
    const loc = json.results[0]?.geometry?.location;
    const lat = typeof loc?.lat === "number" ? loc.lat : Number(loc?.lat);
    const lng = typeof loc?.lng === "number" ? loc.lng : Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  } catch {
    return null;
  }
}

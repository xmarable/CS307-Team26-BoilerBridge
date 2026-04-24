/**
 * Allow only http(s) URLs for outbound links (US16).
 */

export function sanitizeHttpsUrl(raw: string | null | undefined): string | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (u.hostname.length === 0) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** TripAdvisor consumer search (fallback; not an official API). */
export function buildTripadvisorSearchUrl(searchQuery: string): string | null {
  const q = searchQuery.trim();
  if (!q) return null;
  const u = new URL("https://www.tripadvisor.com/Search");
  u.searchParams.set("q", q);
  return sanitizeHttpsUrl(u.toString());
}

/** Google Maps text search in browser (fallback when no place URI). */
export function buildGoogleMapsSearchUrl(searchQuery: string): string | null {
  const q = searchQuery.trim();
  if (!q) return null;
  const u = new URL("https://www.google.com/maps/search/");
  u.searchParams.set("api", "1");
  u.searchParams.set("query", q);
  return sanitizeHttpsUrl(u.toString());
}

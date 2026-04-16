/**
 * Best-effort IANA timezone for itinerary wall-clock planning when the trip
 * model does not store a timezone. Prefer destination, then origin.
 */
const CITY_RULES: { re: RegExp; iana: string }[] = [
  { re: /chicago|evanston|milwaukee|madison/i, iana: "America/Chicago" },
  { re: /west lafayette|lafayette|purdue|indianapolis|bloomington|fort wayne/i, iana: "America/Indiana/Indianapolis" },
  { re: /new york|brooklyn|manhattan|queens|bronx|nyc|boston|philadelphia|washington|dc\b|baltimore/i, iana: "America/New_York" },
  { re: /los angeles|san francisco|seattle|portland|san diego|phoenix|denver|austin|dallas|houston/i, iana: "America/Los_Angeles" },
  { re: /miami|orlando|tampa|atlanta|nashville|new orleans/i, iana: "America/New_York" },
  { re: /london|paris|rome|berlin|madrid|amsterdam|barcelona|dublin/i, iana: "Europe/London" },
];

export function inferPlanningTimezone(...cities: string[]): string {
  for (const raw of cities) {
    const c = typeof raw === "string" ? raw.trim() : "";
    if (!c) continue;
    for (const { re, iana } of CITY_RULES) {
      if (re.test(c)) return iana;
    }
  }
  return "America/Chicago";
}

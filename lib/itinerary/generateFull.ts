import { z } from "zod";

import {
  ProposedEventSchema,
  ProposedEventsResponseSchema,
  type ProposedEventInput,
} from "@/lib/itinerary/schemas";
import {
  ollamaChatJson,
  parseJsonFromOllamaContent,
} from "@/lib/itinerary/ollamaClient";
import type { MustHaveContext, TripContext } from "@/lib/itinerary/generatePartial";
import { inferPlanningTimezone } from "@/lib/itinerary/inferPlanningTimezone";
import { coerceOllamaJsonToProposedEvents } from "@/lib/itinerary/coerceOllamaItineraryJson";

export type { TripContext, MustHaveContext } from "@/lib/itinerary/generatePartial";

function validateFullResponseStrict(raw: unknown): ProposedEventInput[] | null {
  const parsed = ProposedEventsResponseSchema.safeParse(raw);
  if (!parsed.success) return null;
  for (const ev of parsed.data.events) {
    if (ev.endTime <= ev.startTime) {
      return null;
    }
  }
  return parsed.data.events;
}

function sortByStart(events: ProposedEventInput[]): ProposedEventInput[] {
  return [...events].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

function buildFullTripPrompt(
  trip: TripContext,
  approvedMustHaves: MustHaveContext[],
  chronologyCorrectionNote?: string,
): string {
  const budgetRange =
    trip.budgetMin != null || trip.budgetMax != null
      ? ` (range ${trip.budgetMin ?? 0}-${trip.budgetMax ?? "any"})`
      : "";
  const mh =
    approvedMustHaves.length === 0
      ? "(none — suggest a reasonable schedule anyway)"
      : approvedMustHaves
          .map(
            (m) =>
              `- ${m.name}${m.address ? ` @ ${m.address}` : ""}${m.category ? ` [${m.category}]` : ""}${m.placeId ? ` (placeId: ${m.placeId})` : ""}`,
          )
          .join("\n");

  const planningTz = inferPlanningTimezone(trip.toCity, trip.fromCity);

  return `You are a travel planner. Output JSON only.

Trip: ${trip.fromCity} → ${trip.toCity}
Dates: ${trip.fromDate.toISOString().slice(0, 10)} through ${trip.toDate.toISOString().slice(0, 10)} (inclusive window).
Transport mode: ${trip.mode} (use this for realistic travel pacing: flights need airport buffers; bus/train need longer en-route blocks; taxi implies shorter hops inside a metro).
Budget hint: ${trip.budget}${budgetRange}.
Avoid activities: ${(trip.avoidActivities ?? []).join(", ") || "(none)"}.
Avoid locations: ${(trip.avoidLocations ?? []).join(", ") || "(none)"}.

Approved must-include items:
${mh}

Planning timezone (use for the "timezone" field on every event): "${planningTz}".
Destination city for this trip is "${trip.toCity.trim()}". Every real-world venue, meal, or attraction (except explicit intercity travel blocks) MUST be a plausible location in or immediately next to ${trip.toCity.trim()} — not other metros. For national chains (e.g. bakeries, restaurants), put the neighborhood or street context in the "location" field so it is clearly the ${trip.toCity.trim()} branch (e.g. include "${trip.toCity.trim()}" or a well-known local area in that city). Do not schedule NYC/LA/Miami/etc. locations when the destination is ${trip.toCity.trim()}.
Schedule human-style days: morning / afternoon / evening. Typical attractions: about 1–3 hours; meals about 1–1.5 hours.
If ${trip.fromCity.trim()} and ${trip.toCity.trim()} are different cities, do NOT place normal sightseeing before a realistic arrival on day 1 — start day 1 with an explicit travel/transit block or begin attractions mid/late afternoon after implied arrival.
Leave modest gaps between stops in the destination (implicit buffer); do not stack back-to-back all-day attractions.
Never use absurd same-day windows like 00:00→12:00 for a museum or neighborhood walk unless it is clearly labeled overnight travel.

Return a single JSON object: { "events": [ { "title": string, "description"?: string, "startTime": string (ISO 8601), "endTime": string (ISO 8601), "location"?: string, "eventType"?: string, "timezone"?: string } ] }

Rules (must all hold):
- The "events" array is strictly chronological by startTime across the whole trip (sort before returning).
- Same calendar day: no overlapping intervals; leave realistic buffer travel time between stops.
- Every event: endTime strictly after startTime; typical blocks 1–3h (meals ~1–1.5h), not impossible all-day "arrival" windows.
- If ${trip.fromCity.trim()} and ${trip.toCity.trim()} differ: the first substantive leg from origin to destination must be a transport event (eventType "transport", "travel", or "transit", or title clearly states flight/train/bus/taxi between the two cities) and must END before any "arrival", hotel check-in, or destination-only activities that day. Do not schedule "arrival" in ${trip.toCity.trim()} before that outbound transport completes.
- Do not invent multiple redundant "arrival" blocks the same day; at most one arrival/check-in at the destination after the inbound transport leg.
- Use eventType "transport" (preferred), "travel", or "transit" for intercity movement; use concrete titles (e.g. "Flight: Chicago → Miami").
- Include approved must-haves as real events at sensible times after you have logically arrived.
- Set "timezone" to "${planningTz}" on every event (ISO timestamps must match that zone's local intent).
${chronologyCorrectionNote ? `\n\nRegenerate fixing this validation feedback from the previous attempt:\n${chronologyCorrectionNote}\n` : ""}`;
}

function stubFullTrip(
  trip: TripContext,
  mustHaves: MustHaveContext[],
): ProposedEventInput[] {
  const start = new Date(trip.fromDate);
  const end = new Date(trip.toDate);
  const msPerDay = 86400000;
  const days = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / msPerDay) || 1,
  );
  const events: ProposedEventInput[] = [];
  for (let d = 0; d < Math.min(days, 3); d++) {
    const dayStart = new Date(start);
    dayStart.setDate(dayStart.getDate() + d);
    const s = new Date(dayStart);
    s.setHours(10, 0, 0, 0);
    const e = new Date(s);
    e.setHours(12, 0, 0, 0);
    events.push({
      title: `Explore ${trip.toCity} (day ${d + 1})`,
      description: `Stub itinerary (OLLAMA_SKIP). ${trip.fromCity} → ${trip.toCity}`,
      startTime: s,
      endTime: e,
      location: trip.toCity,
      eventType: "activity",
      timezone: "UTC",
    });
  }
  mustHaves.slice(0, 5).forEach((mh, i) => {
    const s = new Date(start);
    s.setDate(s.getDate() + (i % days));
    s.setHours(14, 0, 0, 0);
    const en = new Date(s);
    en.setHours(16, 0, 0, 0);
    events.push({
      title: mh.name,
      description: mh.notes,
      startTime: s,
      endTime: en,
      location: mh.address,
      eventType: mh.category || "activity",
      timezone: "UTC",
    });
  });
  return events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

/**
 * Full-trip itinerary via Ollama. Stub when OLLAMA_SKIP=1.
 */
export async function generateFullTripEvents(
  trip: TripContext,
  approvedMustHaves: MustHaveContext[],
  opts?: { chronologyCorrectionNote?: string },
): Promise<ProposedEventInput[]> {
  if (process.env.OLLAMA_SKIP === "1") {
    return stubFullTrip(trip, approvedMustHaves);
  }

  const prompt = buildFullTripPrompt(
    trip,
    approvedMustHaves,
    opts?.chronologyCorrectionNote,
  );
  const content = await ollamaChatJson([{ role: "user", content: prompt }]);
  let raw: unknown;
  try {
    raw = parseJsonFromOllamaContent(content);
  } catch {
    throw new Error("Ollama returned non-JSON for full itinerary");
  }

  const alt = z.array(ProposedEventSchema).safeParse(raw);
  if (alt.success) {
    const repaired = alt.data.map((ev) =>
      ev.endTime > ev.startTime
        ? ev
        : { ...ev, endTime: new Date(ev.startTime.getTime() + 90 * 60 * 1000) },
    );
    return sortByStart(repaired);
  }

  const strict = validateFullResponseStrict(raw);
  if (strict && strict.length > 0) return sortByStart(strict);

  const coerced = coerceOllamaJsonToProposedEvents(raw);
  if (coerced.length > 0) {
    console.warn(
      "[itinerary] Ollama JSON used relaxed coercion (alternate keys, snake_case, or nested arrays).",
    );
    return sortByStart(coerced);
  }

  console.warn(
    "[itinerary] Ollama returned no parseable events; using deterministic stub itinerary. Raw keys:",
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? Object.keys(raw as object).join(", ")
      : typeof raw,
  );
  return sortByStart(stubFullTrip(trip, approvedMustHaves));
}

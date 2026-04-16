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

export type { TripContext, MustHaveContext } from "@/lib/itinerary/generatePartial";

function validateFullResponse(raw: unknown): ProposedEventInput[] {
  const parsed = ProposedEventsResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Model JSON must be an object with a non-empty events array");
  }
  for (const ev of parsed.data.events) {
    if (ev.endTime <= ev.startTime) {
      throw new Error("Each event must have endTime after startTime");
    }
  }
  return parsed.data.events;
}

function buildFullTripPrompt(
  trip: TripContext,
  approvedMustHaves: MustHaveContext[],
): string {
  const mh =
    approvedMustHaves.length === 0
      ? "(none — suggest a reasonable schedule anyway)"
      : approvedMustHaves
          .map(
            (m) =>
              `- ${m.name}${m.address ? ` @ ${m.address}` : ""}${m.category ? ` [${m.category}]` : ""}`,
          )
          .join("\n");

  return `You are a travel planner. Output JSON only.

Trip: ${trip.fromCity} → ${trip.toCity}
Dates: ${trip.fromDate.toISOString().slice(0, 10)} through ${trip.toDate.toISOString().slice(0, 10)} (inclusive window).
Transport: ${trip.mode}. Budget hint: ${trip.budget}.

Approved must-include items:
${mh}

Return a single JSON object: { "events": [ { "title": string, "description"?: string, "startTime": string (ISO 8601), "endTime": string (ISO 8601), "location"?: string, "eventType"?: string, "timezone"?: string } ] }

Rules:
- Multiple events per day where realistic; each event about 1–4 hours unless travel blocks need longer.
- endTime strictly after startTime for every event.
- Include approved must-haves as real events at sensible times.
- timezone default "UTC" unless justified.`;
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
): Promise<ProposedEventInput[]> {
  if (process.env.OLLAMA_SKIP === "1") {
    return stubFullTrip(trip, approvedMustHaves);
  }

  const prompt = buildFullTripPrompt(trip, approvedMustHaves);
  const content = await ollamaChatJson([{ role: "user", content: prompt }]);
  let raw: unknown;
  try {
    raw = parseJsonFromOllamaContent(content);
  } catch {
    throw new Error("Ollama returned non-JSON for full itinerary");
  }

  const alt = z.array(ProposedEventSchema).safeParse(raw);
  if (alt.success) {
    for (const ev of alt.data) {
      if (ev.endTime <= ev.startTime) {
        throw new Error("Each event must have endTime after startTime");
      }
    }
    return alt.data;
  }

  return validateFullResponse(raw);
}

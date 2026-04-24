import { z } from "zod";

import {
  ProposedEventSchema,
  type AccessibilityRequirements,
  type ProposedEventInput,
} from "@/lib/itinerary/schemas";
import {
  ollamaChatJson,
  parseJsonFromOllamaContent,
} from "@/lib/itinerary/ollamaClient";
import { getActiveAccessibilityRequirements } from "@/lib/travel/accessibility";

export { ProposedEventSchema, type ProposedEventInput } from "@/lib/itinerary/schemas";

export type TripContext = {
  fromCity: string;
  toCity: string;
  fromDate: Date;
  toDate: Date;
  mode: string;
  budget: number;
  budgetMin?: number;
  budgetMax?: number;
  avoidActivities?: string[];
  avoidLocations?: string[];
  accessibilityRequirements?: AccessibilityRequirements;
};

export type MustHaveContext = {
  name: string;
  address?: string;
  category?: string;
  notes?: string;
  placeId?: string;
};

export type TargetEventContext = {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  eventType?: string;
};

export type GeneratePartialItineraryInput = {
  trip: TripContext;
  approvedMustHaves: MustHaveContext[];
  targetEvents: TargetEventContext[];
};

function validateProposedList(raw: unknown): ProposedEventInput[] {
  const arr = z.array(ProposedEventSchema).safeParse(raw);
  if (!arr.success) {
    throw new Error("Invalid proposed events from model");
  }
  for (const ev of arr.data) {
    if (ev.endTime <= ev.startTime) {
      throw new Error("Proposed event has endTime before startTime");
    }
  }
  return arr.data;
}

function buildPrompt(input: GeneratePartialItineraryInput): string {
  const { trip, approvedMustHaves, targetEvents } = input;
  const budgetRange =
    trip.budgetMin != null || trip.budgetMax != null
      ? ` (range ${trip.budgetMin ?? 0}-${trip.budgetMax ?? "any"})`
      : "";
  const mustHaveBlock =
    approvedMustHaves.length === 0
      ? "(none)"
      : approvedMustHaves
          .map(
            (m) =>
              `- ${m.name}${m.address ? ` @ ${m.address}` : ""}${m.category ? ` [${m.category}]` : ""}${m.placeId ? ` (placeId: ${m.placeId})` : ""}${m.notes ? ` — ${m.notes}` : ""}`,
          )
          .join("\n");

  const sliceBlock = targetEvents
    .map(
      (e) =>
        `- ${e.title} (${e.startTime.toISOString()}–${e.endTime.toISOString()})${e.location ? ` @ ${e.location}` : ""}${e.eventType ? ` [${e.eventType}]` : ""}${e.description ? ` — ${e.description}` : ""}`,
    )
    .join("\n");
  const accessibilityNeeds = getActiveAccessibilityRequirements(
    trip.accessibilityRequirements,
  );
  const accessibilityLine =
    accessibilityNeeds.length === 0
      ? "(none)"
      : accessibilityNeeds.join(", ");

  return `You are a travel itinerary assistant.

Trip: ${trip.fromCity} → ${trip.toCity}, ${trip.fromDate.toISOString().slice(0, 10)} to ${trip.toDate.toISOString().slice(0, 10)}.
Transport: ${trip.mode}. Budget hint: ${trip.budget}${budgetRange}.
Destination city is "${trip.toCity.trim()}". Replacement activities must be real venues in or near ${trip.toCity.trim()} (not other cities). For chain brands, make the "location" field explicitly local to ${trip.toCity.trim()}.
Avoid activities: ${(trip.avoidActivities ?? []).join(", ") || "(none)"}.
Avoid locations: ${(trip.avoidLocations ?? []).join(", ") || "(none)"}.
Accessibility requirements: ${accessibilityLine}.

Approved must-have places (must stay reflected in replacements where relevant):
${mustHaveBlock}

Replace ONLY the following scheduled blocks with improved alternatives that still respect the must-haves and fit the trip:
${sliceBlock}

Respond with a JSON object: { "events": [ ... ] }
Each event must have: title (string), description (string, optional), startTime (ISO 8601 string), endTime (ISO 8601 string), location (string, optional), eventType (string, optional), timezone (string, optional, default UTC).
Use realistic same-day durations (about 1–3 hours for typical attractions, ~1–2 hours for meals). Avoid placeholder windows like midnight→noon unless it is an overnight/red-eye travel block labeled as travel/transit.
Events must be strictly chronological: startTime < endTime for each row, no overlapping times, sorted by startTime. Intercity transport must not be preceded by destination "arrival" blocks; use eventType "transport", "travel", or "transit" for real travel segments.
The "events" array MUST contain EXACTLY ${targetEvents.length} objects, in the same order as the slice above. Do not add or merge entries; one output event per input line.
`;
}

async function callOllamaPartial(prompt: string): Promise<unknown[]> {
  const content = await ollamaChatJson([{ role: "user", content: prompt }]);
  let parsed: unknown;
  try {
    parsed = parseJsonFromOllamaContent(content);
  } catch {
    throw new Error("Ollama returned non-JSON");
  }

  const withEvents = parsed as { events?: unknown };
  if (!Array.isArray(withEvents.events)) {
    throw new Error("Model JSON must include an events array");
  }
  return withEvents.events;
}

function stubSingleProposed(e: TargetEventContext): ProposedEventInput {
  const start = new Date(e.startTime);
  const end = new Date(e.endTime);
  const duration = Math.max(end.getTime() - start.getTime(), 15 * 60 * 1000);
  const newStart = new Date(start.getTime() + 5 * 60 * 1000);
  const newEnd = new Date(newStart.getTime() + duration);
  return {
    title: `Regenerated: ${e.title}`,
    description: e.description
      ? `(Updated) ${e.description}`
      : "Fallback slot (model returned too few items).",
    startTime: newStart,
    endTime: newEnd,
    location: e.location,
    eventType: e.eventType ?? "activity",
    timezone: "UTC",
  };
}

function stubProposedEvents(input: GeneratePartialItineraryInput): ProposedEventInput[] {
  return input.targetEvents.map((e) => stubSingleProposed(e));
}

/**
 * Generates replacement itinerary events for the selected slice.
 * Uses local Ollama unless OLLAMA_SKIP=1 (stub) or Ollama errors (thrown to route).
 */
export async function generatePartialItinerary(
  input: GeneratePartialItineraryInput,
): Promise<ProposedEventInput[]> {
  if (input.targetEvents.length === 0) {
    return [];
  }

  if (process.env.OLLAMA_SKIP === "1") {
    return stubProposedEvents(input);
  }

  const prompt = buildPrompt(input);
  const n = input.targetEvents.length;
  let rawList = await callOllamaPartial(prompt);
  if (rawList.length > n) {
    rawList = rawList.slice(0, n);
  }
  while (rawList.length < n) {
    rawList.push(
      stubSingleProposed(input.targetEvents[rawList.length]!),
    );
  }
  return validateProposedList(rawList);
}

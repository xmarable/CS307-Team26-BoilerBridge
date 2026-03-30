import { z } from "zod";

import { ProposedEventSchema, type ProposedEventInput } from "@/lib/itinerary/schemas";

export { ProposedEventSchema, type ProposedEventInput } from "@/lib/itinerary/schemas";

export type TripContext = {
  fromCity: string;
  toCity: string;
  fromDate: Date;
  toDate: Date;
  mode: string;
  budget: number;
};

export type MustHaveContext = {
  name: string;
  address?: string;
  category?: string;
  notes?: string;
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
  const mustHaveBlock =
    approvedMustHaves.length === 0
      ? "(none)"
      : approvedMustHaves
          .map(
            (m) =>
              `- ${m.name}${m.address ? ` @ ${m.address}` : ""}${m.category ? ` [${m.category}]` : ""}${m.notes ? ` — ${m.notes}` : ""}`,
          )
          .join("\n");

  const sliceBlock = targetEvents
    .map(
      (e) =>
        `- ${e.title} (${e.startTime.toISOString()}–${e.endTime.toISOString()})${e.location ? ` @ ${e.location}` : ""}${e.eventType ? ` [${e.eventType}]` : ""}${e.description ? ` — ${e.description}` : ""}`,
    )
    .join("\n");

  return `You are a travel itinerary assistant.

Trip: ${trip.fromCity} → ${trip.toCity}, ${trip.fromDate.toISOString().slice(0, 10)} to ${trip.toDate.toISOString().slice(0, 10)}.
Transport: ${trip.mode}. Budget hint: ${trip.budget}.

Approved must-have places (must stay reflected in replacements where relevant):
${mustHaveBlock}

Replace ONLY the following scheduled blocks with improved alternatives that still respect the must-haves and fit the trip:
${sliceBlock}

Respond with a JSON object: { "events": [ ... ] }
Each event must have: title (string), description (string, optional), startTime (ISO 8601 string), endTime (ISO 8601 string), location (string, optional), eventType (string, optional), timezone (string, optional, default UTC).
Use the SAME number of events as the slice (${targetEvents.length}), in the same order, unless merging is clearly better (prefer same count).
`;
}

async function callOpenAI(prompt: string, eventCount: number): Promise<unknown> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ITINERARY_MODEL ?? "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${errText}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty OpenAI response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI returned non-JSON");
  }

  const withEvents = parsed as { events?: unknown };
  if (!Array.isArray(withEvents.events)) {
    throw new Error("OpenAI JSON must include an events array");
  }
  if (withEvents.events.length !== eventCount) {
    throw new Error(
      `Expected ${eventCount} proposed events, got ${withEvents.events.length}`,
    );
  }
  return withEvents.events;
}

function stubProposedEvents(input: GeneratePartialItineraryInput): ProposedEventInput[] {
  return input.targetEvents.map((e) => {
    const start = new Date(e.startTime);
    const end = new Date(e.endTime);
    const duration = Math.max(end.getTime() - start.getTime(), 15 * 60 * 1000);
    const newStart = new Date(start.getTime() + 5 * 60 * 1000);
    const newEnd = new Date(newStart.getTime() + duration);
    return {
      title: `Regenerated: ${e.title}`,
      description: e.description
        ? `(Updated) ${e.description}`
        : "Stub regeneration (set OPENAI_API_KEY for AI output).",
      startTime: newStart,
      endTime: newEnd,
      location: e.location,
      eventType: e.eventType ?? "activity",
      timezone: "UTC",
    };
  });
}

/**
 * Generates replacement itinerary events for the selected slice.
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise returns a deterministic stub for dev/tests.
 */
export async function generatePartialItinerary(
  input: GeneratePartialItineraryInput,
): Promise<ProposedEventInput[]> {
  if (input.targetEvents.length === 0) {
    return [];
  }

  if (!process.env.OPENAI_API_KEY) {
    return stubProposedEvents(input);
  }

  const prompt = buildPrompt(input);
  const rawList = await callOpenAI(prompt, input.targetEvents.length);
  return validateProposedList(rawList);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ollamaChatJson,
  parseJsonFromOllamaContent,
} from "@/lib/itinerary/ollamaClient";
import {
  ProposedEventSchema,
  type ProposedEventInput,
} from "@/lib/itinerary/schemas";
import { z } from "zod";

/**
 * prompt for ollama to specifically find indoor replacements
 */
function buildRainyDayPrompt(primaryItinerary: any[]): string {
  const outdoorActivities = primaryItinerary
    .filter((a) => a.isOutdoor)
    .map(
      (a) =>
        `- ${a.title} (${a.startTime}–${a.endTime}) [${a.eventType}] @ ${a.location}`,
    )
    .join("\n");

  return `You are a travel assistant. It is raining. 

Replace the following outdoor activities with indoor alternatives (Museums, Indoor Markets, etc.):
${outdoorActivities}

Rules:
1. Suggest a specific indoor alternative for each item.
2. If no specific indoor alternative is obvious, use "Local Coffee Shop" as the fallback.
3. Keep the exact same startTime and endTime for the replacements.
4. Respond with a JSON object: { "events": [ ... ] }
5. The "events" array MUST contain EXACTLY ${primaryItinerary.filter((a) => a.isOutdoor).length} objects.`;
}

/**
 * generates a rainy day alternative using local ollama
 */
export async function generateRainyDayPlan(
  primaryItinerary: any[],
): Promise<ProposedEventInput[]> {
  if (primaryItinerary.length === 0) return [];

  // stub logic for offline/tests
  if (process.env.OLLAMA_SKIP === "1") {
    return primaryItinerary.map((activity) => {
      if (!activity.isOutdoor) return { ...activity };
      return {
        ...activity,
        title: "Local Coffee Shop",
        description:
          "Rainy day fallback: Swapped outdoor activity for a cozy indoor spot.",
        eventType: "Food & Drink",
        isOutdoor: false,
      };
    });
  }

  try {
    const prompt = buildRainyDayPrompt(primaryItinerary);
    const content = await ollamaChatJson([{ role: "user", content: prompt }]);
    const parsed = parseJsonFromOllamaContent(content) as { events: unknown[] };

    // use your existing schema to validate the model output
    const validated = z.array(ProposedEventSchema).parse(parsed.events);

    let replacementIdx = 0;
    return primaryItinerary.map((activity) => {
      if (!activity.isOutdoor) return { ...activity };

      const replacement = validated[replacementIdx++];
      // merge the replacement while keeping the original id/structure if needed
      return {
        ...activity,
        ...replacement,
        isOutdoor: false,
      };
    });
  } catch (error) {
    console.error("Rainy Day Ollama Error:", error);
    // standard fallback if ollama fails or returns bad json
    return primaryItinerary.map((activity) => {
      if (!activity.isOutdoor) return { ...activity };
      return {
        ...activity,
        title: "Local Coffee Shop",
        eventType: "Food & Drink",
        isOutdoor: false,
      };
    });
  }
}

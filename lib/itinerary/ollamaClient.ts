/**
 * Local Ollama: POST /api/chat with JSON format.
 * Env: OLLAMA_BASE_URL (default http://127.0.0.1:11434), OLLAMA_MODEL (e.g. llama3.2:1b).
 * OLLAMA_SKIP=1: throw so callers use stubs (tests / offline).
 */

import { formatOllamaHttpError } from "@/lib/itinerary/ollamaErrors";

export type OllamaChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

function stripJsonFence(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    return t
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/m, "")
      .trim();
  }
  return t;
}

export function parseJsonFromOllamaContent(content: string): unknown {
  const raw = stripJsonFence(content.trim());
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error("Could not parse JSON from model output");
  }
}

export async function ollamaChatJson(
  messages: OllamaChatMessage[],
): Promise<string> {
  if (process.env.OLLAMA_SKIP === "1") {
    throw new Error("OLLAMA_SKIP");
  }

  const base = (process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(
    /\/$/,
    "",
  );
  const model = process.env.OLLAMA_MODEL ?? "llama3.2:1b";

  let res: Response;
  try {
    res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: "json",
      }),
    });
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not reach Ollama at ${base}. Is Ollama running? (${reason})`,
    );
  }

  if (!res.ok) {
    const t = await res.text();
    throw new Error(formatOllamaHttpError(res.status, t, model));
  }

  const data = (await res.json()) as {
    message?: { content?: string };
  };
  const content = data.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Ollama returned empty message content");
  }
  return content;
}

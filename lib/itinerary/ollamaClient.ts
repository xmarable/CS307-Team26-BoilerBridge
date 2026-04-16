/**
 * Local Ollama: POST /api/chat with JSON format.
 * Env: OLLAMA_BASE_URL (default http://127.0.0.1:11434), OLLAMA_MODEL (e.g. llama3.2).
 * OLLAMA_SKIP=1: throw so callers use stubs (tests / offline).
 */

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
  const raw = stripJsonFence(content);
  return JSON.parse(raw);
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
  const model = process.env.OLLAMA_MODEL ?? "llama3.2";

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      format: "json",
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama HTTP ${res.status}: ${t.slice(0, 500)}`);
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

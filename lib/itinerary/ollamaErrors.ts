/**
 * Turns Ollama HTTP failures into actionable messages for API/UI.
 */

export function formatOllamaHttpError(
  status: number,
  bodyText: string,
  model: string,
): string {
  const trimmed = bodyText.trim();
  let serverMessage: string | null = null;
  try {
    const parsed = JSON.parse(trimmed) as { error?: unknown };
    if (typeof parsed?.error === "string" && parsed.error.trim()) {
      serverMessage = parsed.error.trim();
    }
  } catch {
    // non-JSON body
  }

  if (status === 404) {
    const hint = `No local model matches "${model}". Run: ollama pull ${model}`;
    return serverMessage ? `${hint} (Ollama: ${serverMessage})` : hint;
  }

  const suffix = serverMessage ?? trimmed.slice(0, 400);
  return suffix
    ? `Ollama HTTP ${status}: ${suffix}`
    : `Ollama HTTP ${status} (empty response body)`;
}

import { formatOllamaHttpError } from "@/lib/itinerary/ollamaErrors";

describe("formatOllamaHttpError", () => {
  it("explains 404 as missing local model with pull hint", () => {
    const msg = formatOllamaHttpError(
      404,
      '{"error":"model \\"llama3.2:1b\\" not found"}',
      "llama3.2:1b",
    );
    expect(msg).toContain("ollama pull llama3.2:1b");
    expect(msg).toContain("llama3.2:1b");
  });

  it("handles non-JSON 404 bodies", () => {
    const msg = formatOllamaHttpError(404, "not found", "mistral");
    expect(msg).toMatch(/ollama pull mistral/i);
  });
});

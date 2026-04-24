import {
  coerceOllamaJsonToProposedEvents,
  normalizeProposedEventKeys,
} from "@/lib/itinerary/coerceOllamaItineraryJson";
import { parseJsonFromOllamaContent } from "@/lib/itinerary/ollamaClient";

describe("coerceOllamaJsonToProposedEvents", () => {
  it("parses strict { events: [...] }", () => {
    const out = coerceOllamaJsonToProposedEvents({
      events: [
        {
          title: "Museum",
          startTime: "2026-06-11T14:00:00.000Z",
          endTime: "2026-06-11T16:00:00.000Z",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("Museum");
  });

  it("reads itinerary / schedule keys", () => {
    const out = coerceOllamaJsonToProposedEvents({
      itinerary: [
        {
          title: "Lunch",
          startTime: "2026-06-11T12:00:00.000Z",
          endTime: "2026-06-11T13:00:00.000Z",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("Lunch");
  });

  it("accepts snake_case times", () => {
    const out = coerceOllamaJsonToProposedEvents({
      events: [
        {
          title: "Walk",
          start_time: "2026-06-11T10:00:00.000Z",
          end_time: "2026-06-11T11:00:00.000Z",
        },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.title).toBe("Walk");
  });

  it("flattens days[].events", () => {
    const out = coerceOllamaJsonToProposedEvents({
      days: [
        {
          date: "2026-06-11",
          events: [
            {
              title: "Day block A",
              startTime: "2026-06-11T09:00:00.000Z",
              endTime: "2026-06-11T10:00:00.000Z",
            },
          ],
        },
        {
          date: "2026-06-12",
          events: [
            {
              title: "Day block B",
              startTime: "2026-06-12T09:00:00.000Z",
              endTime: "2026-06-12T10:00:00.000Z",
            },
          ],
        },
      ],
    });
    expect(out.map((e) => e.title)).toEqual(["Day block A", "Day block B"]);
  });

  it("returns [] when nothing is parseable", () => {
    expect(coerceOllamaJsonToProposedEvents({ events: [] })).toEqual([]);
    expect(coerceOllamaJsonToProposedEvents({ foo: 1 })).toEqual([]);
  });
});

describe("parseJsonFromOllamaContent", () => {
  it("parses JSON embedded after prose using brace slice", () => {
    const raw = parseJsonFromOllamaContent(
      'Sure! Here you go:\n{"events":[{"title":"A","startTime":"2026-01-01T10:00:00.000Z","endTime":"2026-01-01T11:00:00.000Z"}]}',
    );
    expect((raw as { events?: unknown[] }).events).toHaveLength(1);
  });
});

describe("normalizeProposedEventKeys", () => {
  it("maps name to title", () => {
    const n = normalizeProposedEventKeys({
      name: "Skydeck",
      startTime: "2026-01-01T12:00:00.000Z",
      endTime: "2026-01-01T13:00:00.000Z",
    });
    expect((n as { title?: string }).title).toBe("Skydeck");
  });
});

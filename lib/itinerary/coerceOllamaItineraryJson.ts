import { z } from "zod";

import { ProposedEventSchema, type ProposedEventInput } from "@/lib/itinerary/schemas";

const ResponseWithEvents = z.object({
  events: z.array(z.unknown()),
});

/** Same shape as strict response but allows empty arrays (small models often emit those). */
const ResponseWithEventsLoose = z.object({
  events: z.array(z.unknown()).optional(),
});

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Maps common alternate / snake_case keys onto ProposedEventSchema field names.
 */
export function normalizeProposedEventKeys(input: unknown): unknown {
  if (!isPlainObject(input)) return input;
  const o = input;
  const titleRaw = o.title ?? o.name ?? o.activity ?? o.place;
  const title =
    typeof titleRaw === "string"
      ? titleRaw
      : typeof titleRaw === "number"
        ? String(titleRaw)
        : undefined;
  return {
    title,
    description:
      (typeof o.description === "string" ? o.description : undefined) ??
      (typeof o.desc === "string" ? o.desc : undefined),
    startTime:
      o.startTime ??
      o.start_time ??
      o.startsAt ??
      o.begin ??
      o.start ??
      o.from,
    endTime: o.endTime ?? o.end_time ?? o.endsAt ?? o.finish ?? o.end ?? o.to,
    location:
      (typeof o.location === "string" ? o.location : undefined) ??
      (typeof o.address === "string" ? o.address : undefined) ??
      (typeof o.place === "string" ? o.place : undefined),
    eventType:
      (typeof o.eventType === "string" ? o.eventType : undefined) ??
      (typeof o.event_type === "string" ? o.event_type : undefined) ??
      (typeof o.type === "string" ? o.type : undefined),
    timezone:
      (typeof o.timezone === "string" ? o.timezone : undefined) ??
      (typeof o.time_zone === "string" ? o.time_zone : undefined),
  };
}

function arrayKeysLikelyToHoldEvents(o: Record<string, unknown>): string[] {
  const preferred = [
    "events",
    "itinerary",
    "schedule",
    "activities",
    "plan",
    "days",
    "items",
  ];
  const keys = Object.keys(o);
  const ordered = [
    ...preferred.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !preferred.includes(k)),
  ];
  return ordered;
}

function flattenDaywiseSchedule(o: Record<string, unknown>): unknown[] | null {
  const days = o.days;
  if (!Array.isArray(days) || days.length === 0) return null;
  const flat: unknown[] = [];
  for (const d of days) {
    if (!isPlainObject(d)) continue;
    const evs = d.events ?? d.items ?? d.activities;
    if (Array.isArray(evs)) {
      for (const row of evs) flat.push(row);
    } else if (isPlainObject(d) && (d.title || d.name)) {
      flat.push(d);
    }
  }
  return flat.length > 0 ? flat : null;
}

function firstNonEmptyObjectArray(o: Record<string, unknown>): unknown[] | null {
  const flatDays = flattenDaywiseSchedule(o);
  if (flatDays) return flatDays;

  for (const k of arrayKeysLikelyToHoldEvents(o)) {
    const v = o[k];
    if (!Array.isArray(v) || v.length === 0) continue;
    if (v.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) {
      return v;
    }
  }
  return null;
}

/** Depth-first search for arrays of event-shaped objects (handles nested wrappers). */
function deepFindEventArrays(node: unknown, depth: number): unknown[][] {
  if (depth > 8) return [];
  if (Array.isArray(node)) {
    if (
      node.length > 0 &&
      node.every((x) => x !== null && typeof x === "object" && !Array.isArray(x))
    ) {
      return [node];
    }
    return node.flatMap((child) => deepFindEventArrays(child, depth + 1));
  }
  if (isPlainObject(node)) {
    return Object.values(node).flatMap((v) => deepFindEventArrays(v, depth + 1));
  }
  return [];
}

function parseEventRow(item: unknown): ProposedEventInput | null {
  const normalized = normalizeProposedEventKeys(item);
  const parsed = ProposedEventSchema.safeParse(normalized);
  if (!parsed.success) return null;
  const ev = parsed.data;
  if (ev.endTime.getTime() > ev.startTime.getTime()) return ev;
  const repairedEnd = new Date(ev.startTime.getTime() + 90 * 60 * 1000);
  return { ...ev, endTime: repairedEnd };
}

function parseEventList(rows: unknown[]): ProposedEventInput[] {
  const out: ProposedEventInput[] = [];
  for (const row of rows) {
    const ev = parseEventRow(row);
    if (ev) out.push(ev);
  }
  return out;
}

/**
 * Extracts itinerary events from common Ollama JSON shapes (including snake_case
 * and alternate array keys). Returns an empty array only when nothing could be parsed.
 */
export function coerceOllamaJsonToProposedEvents(raw: unknown): ProposedEventInput[] {
  if (raw === null || raw === undefined) return [];

  if (Array.isArray(raw)) {
    return parseEventList(raw);
  }

  if (!isPlainObject(raw)) return [];

  const direct = firstNonEmptyObjectArray(raw);
  if (direct) {
    const parsed = parseEventList(direct);
    if (parsed.length > 0) return parsed;
  }

  const nested = ResponseWithEventsLoose.safeParse(raw);
  if (nested.success && nested.data.events && nested.data.events.length > 0) {
    const parsed = parseEventList(nested.data.events);
    if (parsed.length > 0) return parsed;
  }

  const strictNested = ResponseWithEvents.safeParse(raw);
  if (strictNested.success && strictNested.data.events.length > 0) {
    const parsed = parseEventList(strictNested.data.events);
    if (parsed.length > 0) return parsed;
  }

  const deep = deepFindEventArrays(raw, 0);
  for (const arr of deep) {
    const parsed = parseEventList(arr);
    if (parsed.length > 0) return parsed;
  }

  return [];
}

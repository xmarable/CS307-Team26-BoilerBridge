import { z } from "zod";
import {
  ACCESSIBILITY_REQUIREMENT_KEYS,
  AccessibilityRequirementsSchema,
  type AccessibilityRequirements,
} from "@/lib/itinerary/schemas";

export type PlaceAccessibilityInfo = Partial<
  Record<(typeof ACCESSIBILITY_REQUIREMENT_KEYS)[number], boolean>
>;

export const AccessibilityQuerySchema = AccessibilityRequirementsSchema.partial();

export function getActiveAccessibilityRequirements(
  requirements: AccessibilityRequirements | null | undefined,
): (typeof ACCESSIBILITY_REQUIREMENT_KEYS)[number][] {
  const parsed = AccessibilityRequirementsSchema.parse(requirements ?? {});
  return ACCESSIBILITY_REQUIREMENT_KEYS.filter((key) => parsed[key]);
}

export function hasAnyAccessibilityRequirement(
  requirements: AccessibilityRequirements | null | undefined,
): boolean {
  return getActiveAccessibilityRequirements(requirements).length > 0;
}

export function parseAccessibilityRequirementsFromSearchParams(
  searchParams: URLSearchParams,
): {
  ok: true;
  data: AccessibilityRequirements;
} | {
  ok: false;
  error: string;
  details: ReturnType<NonNullable<ReturnType<typeof AccessibilityQuerySchema.safeParse>["error"]>["flatten"]>;
} {
  const raw: Record<string, unknown> = {};
  for (const key of ACCESSIBILITY_REQUIREMENT_KEYS) {
    const val = searchParams.get(key);
    if (val == null || val.trim() === "") continue;
    if (val === "true") raw[key] = true;
    else if (val === "false") raw[key] = false;
    else raw[key] = val;
  }

  const parsed = AccessibilityQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid accessibility filters",
      details: parsed.error.flatten(),
    };
  }

  return {
    ok: true,
    data: AccessibilityRequirementsSchema.parse(parsed.data),
  };
}

/**
 * Strict matching:
 * - If a requirement is true, candidate must explicitly be true.
 * - false requirements do not constrain matching.
 */
export function matchesAccessibilityRequirements(
  place: PlaceAccessibilityInfo | null | undefined,
  requirements: AccessibilityRequirements | null | undefined,
): boolean {
  const req = AccessibilityRequirementsSchema.parse(requirements ?? {});
  const active = getActiveAccessibilityRequirements(req);
  if (active.length === 0) return true;
  const source = place ?? {};

  for (const key of active) {
    if (source[key] !== true) return false;
  }
  return true;
}

/** Human-readable labels for trip accessibility toggles (UI + TA demos). */
export const ACCESSIBILITY_FEATURE_LABELS: Record<
  (typeof ACCESSIBILITY_REQUIREMENT_KEYS)[number],
  string
> = {
  wheelchairAccessible: "Wheelchair-accessible entrance",
  stepFree: "Step-free access",
  accessibleRestroom: "Accessible restroom",
  hearingAssistance: "Hearing assistance",
  visualAssistance: "Visual assistance",
};

export type AccessibilityVenueRowStatus = "met" | "not_met" | "unknown";

/**
 * For each trip requirement that is turned on, compare to optional venue
 * fields from the linked Activity / Places row.
 */
export function accessibilityRowsForVenue(
  requirements: AccessibilityRequirements | null | undefined,
  venue: PlaceAccessibilityInfo | null | undefined,
): Array<{
  key: (typeof ACCESSIBILITY_REQUIREMENT_KEYS)[number];
  label: string;
  status: AccessibilityVenueRowStatus;
}> {
  const req = AccessibilityRequirementsSchema.parse(requirements ?? {});
  const active = getActiveAccessibilityRequirements(req);
  const src = venue ?? {};
  return active.map((key) => {
    const v = src[key];
    let status: AccessibilityVenueRowStatus;
    if (v === true) status = "met";
    else if (v === false) status = "not_met";
    else status = "unknown";
    return { key, label: ACCESSIBILITY_FEATURE_LABELS[key], status };
  });
}


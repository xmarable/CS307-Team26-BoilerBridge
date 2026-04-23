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
  details: z.typeToFlattenedError<AccessibilityRequirements>;
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


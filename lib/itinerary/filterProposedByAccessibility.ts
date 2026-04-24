import Activity from "@/models/Activity";
import type { ProposedEventInput } from "@/lib/itinerary/schemas";
import type { ResolvedActivityLink } from "@/lib/itinerary/resolveActivityLinks";
import type { AccessibilityRequirements } from "@/lib/itinerary/schemas";
import {
  hasAnyAccessibilityRequirement,
  matchesAccessibilityRequirements,
} from "@/lib/travel/accessibility";

type Result = {
  proposed: ProposedEventInput[];
  linkRows: ResolvedActivityLink[];
  removedCount: number;
};

export async function filterProposedEventsByAccessibility(
  proposed: ProposedEventInput[],
  linkRows: ResolvedActivityLink[],
  requirements: AccessibilityRequirements | null | undefined,
): Promise<Result> {
  if (!hasAnyAccessibilityRequirement(requirements) || proposed.length === 0) {
    return { proposed, linkRows, removedCount: 0 };
  }

  const linkedActivityIds = [
    ...new Set(
      linkRows
        .map((row) => row.linkedActivityId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const linkedPlaceIds = [
    ...new Set(
      linkRows
        .map((row) => row.linkedPlaceId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const lookup = new Map<
    string,
    {
      wheelchairAccessible?: boolean;
      stepFree?: boolean;
      accessibleRestroom?: boolean;
      hearingAssistance?: boolean;
      visualAssistance?: boolean;
    }
  >();

  if (linkedActivityIds.length > 0 || linkedPlaceIds.length > 0) {
    const query: Record<string, unknown>[] = [];
    if (linkedActivityIds.length > 0) query.push({ _id: { $in: linkedActivityIds } });
    if (linkedPlaceIds.length > 0) query.push({ placeId: { $in: linkedPlaceIds } });

    const docs = await Activity.find({ $or: query })
      .select({
        _id: 1,
        placeId: 1,
        wheelchairAccessible: 1,
        stepFree: 1,
        accessibleRestroom: 1,
        hearingAssistance: 1,
        visualAssistance: 1,
      })
      .lean();

    for (const doc of docs) {
      const mapped = {
        wheelchairAccessible:
          typeof doc.wheelchairAccessible === "boolean"
            ? doc.wheelchairAccessible
            : undefined,
        stepFree: typeof doc.stepFree === "boolean" ? doc.stepFree : undefined,
        accessibleRestroom:
          typeof doc.accessibleRestroom === "boolean"
            ? doc.accessibleRestroom
            : undefined,
        hearingAssistance:
          typeof doc.hearingAssistance === "boolean"
            ? doc.hearingAssistance
            : undefined,
        visualAssistance:
          typeof doc.visualAssistance === "boolean"
            ? doc.visualAssistance
            : undefined,
      };
      lookup.set(String(doc._id), mapped);
      if (typeof doc.placeId === "string" && doc.placeId.trim()) {
        lookup.set(doc.placeId.trim(), mapped);
      }
    }
  }

  const keepIndices: number[] = [];
  for (let i = 0; i < proposed.length; i++) {
    const link = linkRows[i];
    const key = link?.linkedActivityId?.trim() || link?.linkedPlaceId?.trim();
    const candidate = key ? lookup.get(key) : undefined;
    // If we have no accessibility metadata for this row, keep it instead of
    // hard-failing the entire generated itinerary.
    if (!candidate) {
      keepIndices.push(i);
      continue;
    }
    if (matchesAccessibilityRequirements(candidate, requirements)) {
      keepIndices.push(i);
    }
  }

  return {
    proposed: keepIndices.map((idx) => proposed[idx]!),
    linkRows: keepIndices.map((idx) => linkRows[idx] ?? {}),
    removedCount: proposed.length - keepIndices.length,
  };
}


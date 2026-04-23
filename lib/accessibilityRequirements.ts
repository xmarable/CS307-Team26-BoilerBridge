import type { AccessibilityRequirements } from "@/lib/itinerary/schemas";

export type AccessibilityRequirementKey = keyof AccessibilityRequirements;

export const ACCESSIBILITY_REQUIREMENT_OPTIONS: Array<{
  key: AccessibilityRequirementKey;
  label: string;
  description: string;
}> = [
  {
    key: "wheelchairAccessible",
    label: "Wheelchair accessible entrance",
    description: "Requires step-free wheelchair entry.",
  },
  {
    key: "stepFree",
    label: "Step-free venue",
    description: "Avoid venues with stairs where possible.",
  },
  {
    key: "accessibleRestroom",
    label: "Accessible restroom",
    description: "Venue should offer accessible restroom access.",
  },
  {
    key: "hearingAssistance",
    label: "Hearing assistance",
    description: "Prefer venues with hearing support options.",
  },
  {
    key: "visualAssistance",
    label: "Visual assistance",
    description: "Prefer venues with visual accessibility support.",
  },
];

export function emptyAccessibilityRequirements(): AccessibilityRequirements {
  return {
    wheelchairAccessible: false,
    stepFree: false,
    accessibleRestroom: false,
    hearingAssistance: false,
    visualAssistance: false,
  };
}


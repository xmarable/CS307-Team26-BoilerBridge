import { z } from "zod";

export const ACCESSIBILITY_REQUIREMENT_KEYS = [
  "wheelchairAccessible",
  "stepFree",
  "accessibleRestroom",
  "hearingAssistance",
  "visualAssistance",
] as const;

export const AccessibilityRequirementsSchema = z
  .object({
    wheelchairAccessible: z.boolean().optional().default(false),
    stepFree: z.boolean().optional().default(false),
    accessibleRestroom: z.boolean().optional().default(false),
    hearingAssistance: z.boolean().optional().default(false),
    visualAssistance: z.boolean().optional().default(false),
  })
  .strict();

export type AccessibilityRequirements = z.infer<
  typeof AccessibilityRequirementsSchema
>;
export const ProposedEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  location: z.string().optional(),
  eventType: z.string().optional(),
  timezone: z.string().optional(),
});

export type ProposedEventInput = z.infer<typeof ProposedEventSchema>;

export const ProposedEventsResponseSchema = z.object({
  events: z.array(ProposedEventSchema).min(1),
});

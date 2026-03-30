import { z } from "zod";

/** Plain event fields suitable for CalendarEvent.create (no DB ids). */
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

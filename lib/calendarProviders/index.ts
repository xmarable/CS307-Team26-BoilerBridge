export interface ExternalCalendar {
  id: string;
  name: string;
  primary?: boolean;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  timezone?: string;
}

export interface ICalendarProvider {
  listCalendars(accessToken: string): Promise<ExternalCalendar[]>;
  createEvent(
    accessToken: string,
    calendarId: string,
    event: CreateEventInput,
  ): Promise<{ id: string }>;
  updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<CreateEventInput>,
  ): Promise<void>;
  deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void>;
}

export { GoogleCalendarProvider } from "./google";
export { OutlookCalendarProvider } from "./outlook";
export { MockCalendarProvider } from "./mock";

import { GoogleCalendarProvider } from "./google";
import { OutlookCalendarProvider } from "./outlook";
import { MockCalendarProvider } from "./mock";

export function getProvider(provider: string): ICalendarProvider {
  // In test environments, always use the mock provider
  if (process.env.CALENDAR_PROVIDER_OVERRIDE === "mock") {
    return new MockCalendarProvider();
  }
  switch (provider) {
    case "google":
      return new GoogleCalendarProvider();
    case "outlook":
      return new OutlookCalendarProvider();
    default:
      throw new Error(`Unsupported calendar provider: ${provider}`);
  }
}

export const SUPPORTED_PROVIDERS = ["google", "outlook"] as const;

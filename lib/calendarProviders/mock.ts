import type {
  ICalendarProvider,
  ExternalCalendar,
  CreateEventInput,
} from "./index";

let counter = 1;

export const mockCreatedEvents = new Map<string, any>();
export const mockUpdatedEvents = new Map<string, any>();
export const mockDeletedEventIds = new Set<string>();

export function resetMockProviderState() {
  counter = 1;
  mockCreatedEvents.clear();
  mockUpdatedEvents.clear();
  mockDeletedEventIds.clear();
}

export class MockCalendarProvider implements ICalendarProvider {
  async listCalendars(_accessToken: string): Promise<ExternalCalendar[]> {
    return [
      { id: "mock-primary", name: "Primary Calendar", primary: true },
      { id: "mock-work", name: "Work Calendar", primary: false },
    ];
  }

  async createEvent(
    _accessToken: string,
    calendarId: string,
    event: CreateEventInput,
  ): Promise<{ id: string }> {
    const id = `mock-ext-event-${counter++}`;
    mockCreatedEvents.set(id, { id, calendarId, ...event });
    return { id };
  }

  async updateEvent(
    _accessToken: string,
    _calendarId: string,
    eventId: string,
    event: Partial<CreateEventInput>,
  ): Promise<void> {
    mockUpdatedEvents.set(eventId, event);
  }

  async deleteEvent(
    _accessToken: string,
    _calendarId: string,
    eventId: string,
  ): Promise<void> {
    mockDeletedEventIds.add(eventId);
    mockCreatedEvents.delete(eventId);
  }
}

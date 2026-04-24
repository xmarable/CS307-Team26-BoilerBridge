import type {
  ICalendarProvider,
  ExternalCalendar,
  CreateEventInput,
} from "./index";

export class GoogleCalendarProvider implements ICalendarProvider {
  private readonly BASE = "https://www.googleapis.com/calendar/v3";

  async listCalendars(accessToken: string): Promise<ExternalCalendar[]> {
    const res = await fetch(`${this.BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok)
      throw new Error(`Google Calendar API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.items ?? []).map((c: any) => ({
      id: c.id,
      name: c.summary,
      primary: c.primary ?? false,
    }));
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: CreateEventInput,
  ): Promise<{ id: string }> {
    const body = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: { dateTime: event.startTime.toISOString(), timeZone: event.timezone ?? "UTC" },
      end: { dateTime: event.endTime.toISOString(), timeZone: event.timezone ?? "UTC" },
    };
    const res = await fetch(
      `${this.BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok)
      throw new Error(`Google Calendar API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { id: data.id };
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<CreateEventInput>,
  ): Promise<void> {
    const body: any = {};
    if (event.title !== undefined) body.summary = event.title;
    if (event.description !== undefined) body.description = event.description;
    if (event.location !== undefined) body.location = event.location;
    if (event.startTime)
      body.start = { dateTime: event.startTime.toISOString(), timeZone: event.timezone ?? "UTC" };
    if (event.endTime)
      body.end = { dateTime: event.endTime.toISOString(), timeZone: event.timezone ?? "UTC" };

    const res = await fetch(
      `${this.BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok)
      throw new Error(`Google Calendar API error ${res.status}: ${await res.text()}`);
  }

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    const res = await fetch(
      `${this.BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    // 410 Gone means the event was already deleted; that's fine
    if (!res.ok && res.status !== 410)
      throw new Error(`Google Calendar API error ${res.status}: ${await res.text()}`);
  }
}

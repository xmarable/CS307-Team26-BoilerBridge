import type {
  ICalendarProvider,
  ExternalCalendar,
  CreateEventInput,
} from "./index";

export class OutlookCalendarProvider implements ICalendarProvider {
  private readonly BASE = "https://graph.microsoft.com/v1.0";

  async listCalendars(accessToken: string): Promise<ExternalCalendar[]> {
    const res = await fetch(`${this.BASE}/me/calendars`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok)
      throw new Error(`Microsoft Graph API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.value ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      primary: c.isDefaultCalendar ?? false,
    }));
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: CreateEventInput,
  ): Promise<{ id: string }> {
    const body: any = {
      subject: event.title,
      body: { contentType: "text", content: event.description ?? "" },
      start: { dateTime: event.startTime.toISOString(), timeZone: event.timezone ?? "UTC" },
      end: { dateTime: event.endTime.toISOString(), timeZone: event.timezone ?? "UTC" },
    };
    if (event.location) body.location = { displayName: event.location };

    const res = await fetch(
      `${this.BASE}/me/calendars/${encodeURIComponent(calendarId)}/events`,
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
      throw new Error(`Microsoft Graph API error ${res.status}: ${await res.text()}`);
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
    if (event.title !== undefined) body.subject = event.title;
    if (event.description !== undefined)
      body.body = { contentType: "text", content: event.description };
    if (event.location !== undefined)
      body.location = { displayName: event.location };
    if (event.startTime)
      body.start = { dateTime: event.startTime.toISOString(), timeZone: event.timezone ?? "UTC" };
    if (event.endTime)
      body.end = { dateTime: event.endTime.toISOString(), timeZone: event.timezone ?? "UTC" };

    const res = await fetch(
      `${this.BASE}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
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
      throw new Error(`Microsoft Graph API error ${res.status}: ${await res.text()}`);
  }

  async deleteEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<void> {
    const res = await fetch(
      `${this.BASE}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    if (!res.ok && res.status !== 404)
      throw new Error(`Microsoft Graph API error ${res.status}: ${await res.text()}`);
  }
}

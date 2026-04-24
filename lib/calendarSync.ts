import dbConnect from "@/lib/dbConnect";
import { encrypt, decrypt } from "@/lib/tokenEncryption";
import { getProvider, type CreateEventInput } from "@/lib/calendarProviders/index";
import CalendarConnection from "@/models/CalendarConnection";
import CalendarEventSync from "@/models/CalendarEventSync";
import CalendarEvent from "@/models/CalendarEvent";

async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const data = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

async function refreshOutlookToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        refresh_token: refreshToken,
        scope: "https://graph.microsoft.com/Calendars.ReadWrite offline_access",
      }),
    },
  );
  if (!res.ok) throw new Error(`Outlook token refresh failed: ${res.status}`);
  const data = await res.json();
  return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

/**
 * Returns a valid (non-expired) plaintext access token, refreshing if needed.
 * Persists new token to DB on refresh. Throws and sets syncError on failure.
 */
export async function getValidAccessToken(connection: any): Promise<string> {
  const now = Date.now();
  const expiresAt = new Date(connection.tokenExpiresAt).getTime();
  const BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

  if (expiresAt - now > BUFFER_MS) {
    return decrypt(connection.encryptedAccessToken);
  }

  if (!connection.encryptedRefreshToken) {
    throw new Error("Access token expired and no refresh token is available");
  }

  const refreshToken = decrypt(connection.encryptedRefreshToken);

  let newAccessToken: string;
  let expiresIn: number;

  if (connection.provider === "google") {
    ({ accessToken: newAccessToken, expiresIn } = await refreshGoogleToken(refreshToken));
  } else if (connection.provider === "outlook") {
    ({ accessToken: newAccessToken, expiresIn } = await refreshOutlookToken(refreshToken));
  } else {
    throw new Error(`Cannot refresh token for unknown provider: ${connection.provider}`);
  }

  const newExpiry = new Date(now + expiresIn * 1000);
  await CalendarConnection.findByIdAndUpdate(connection._id, {
    encryptedAccessToken: encrypt(newAccessToken),
    tokenExpiresAt: newExpiry,
    $unset: { syncError: 1 },
  });

  return newAccessToken;
}

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
}

/**
 * Pushes all CalendarEvents for a group to the user's linked external calendar.
 * Creates CalendarEventSync records for new events; updates existing ones.
 */
export async function syncGroupEvents(
  connectionId: string,
  userId: string,
  groupId: string,
): Promise<SyncResult> {
  await dbConnect();

  const connection = await CalendarConnection.findOne({ _id: connectionId, userId });
  if (!connection) throw new Error("Calendar connection not found");
  if (!connection.syncEnabled) throw new Error("Sync is not enabled for this connection");
  if (!connection.calendarId) throw new Error("No calendar selected — update sync settings first");

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(connection);
  } catch (err: any) {
    await CalendarConnection.findByIdAndUpdate(connectionId, { syncError: err.message });
    throw err;
  }

  const provider = getProvider(connection.provider);
  const events = await CalendarEvent.find({ groupId } as any);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const event of events) {
    const calEventId = event._id.toString();
    try {
      const eventData: CreateEventInput = {
        title: event.title,
        description: event.description,
        startTime: event.startTime,
        endTime: event.endTime,
        location: event.location,
        timezone: event.timezone ?? "UTC",
      };

      const existingSync = await CalendarEventSync.findOne({
        connectionId: connectionId.toString(),
        calendarEventId: calEventId,
      });

      if (existingSync) {
        await provider.updateEvent(
          accessToken,
          connection.calendarId,
          existingSync.externalEventId,
          eventData,
        );
      } else {
        const { id: externalEventId } = await provider.createEvent(
          accessToken,
          connection.calendarId,
          eventData,
        );
        await CalendarEventSync.create({
          connectionId: connectionId.toString(),
          calendarEventId: calEventId,
          externalEventId,
          provider: connection.provider,
        });
      }
      synced++;
    } catch (err: any) {
      errors.push(`"${event.title}": ${err.message}`);
      skipped++;
    }
  }

  await CalendarConnection.findByIdAndUpdate(connectionId, {
    lastSyncedAt: new Date(),
    syncError: errors.length > 0 ? errors[0] : undefined,
  });

  return { synced, skipped, errors };
}

/**
 * Removes a CalendarEventSync record and deletes the event from the external calendar.
 */
export async function removeExternalEvent(
  connectionId: string,
  calendarEventId: string,
): Promise<void> {
  await dbConnect();

  const sync = await CalendarEventSync.findOne({ connectionId, calendarEventId });
  if (!sync) return;

  const connection = await CalendarConnection.findById(connectionId);
  if (!connection) return;

  try {
    const accessToken = await getValidAccessToken(connection);
    const provider = getProvider(connection.provider);
    if (connection.calendarId) {
      await provider.deleteEvent(accessToken, connection.calendarId, sync.externalEventId);
    }
  } catch {
    // Best-effort delete; don't block on provider error
  }

  await CalendarEventSync.deleteOne({ _id: sync._id });
}

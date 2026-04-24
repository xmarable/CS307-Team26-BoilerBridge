/**
 * RFC 5545 iCalendar (subset) for itinerary export.
 * DTSTART/DTEND are emitted in UTC (Z); Mongo stores Date as UTC. Event `timezone`
 * on the document is not used for VTIMEZONE (informational only).
 */

export type IcsEventInput = {
  /** Stable unique id for UID property */
  uid: string;
  startTime: Date;
  endTime: Date;
  summary: string;
  description?: string;
  location?: string;
};

/** RFC 5545 TEXT escaping for SUMMARY, DESCRIPTION, LOCATION */
export function escapeIcalText(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** UTC DATE-TIME as YYYYMMDDTHHmmssZ */
export function formatIcalDateUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const sec = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${day}T${h}${min}${sec}Z`;
}

/**
 * Fold a content line to max 75 octets per segment (RFC 5545).
 * Continuation lines start with one space.
 */
export function foldIcalLine(line: string): string {
  const buf = Buffer.from(line, "utf8");
  if (buf.length <= 75) return line;
  const parts: string[] = [];
  parts.push(buf.subarray(0, 75).toString("utf8"));
  let i = 75;
  while (i < buf.length) {
    const take = Math.min(74, buf.length - i);
    parts.push(` ${buf.subarray(i, i + take).toString("utf8")}`);
    i += take;
  }
  return parts.join("\r\n");
}

function property(name: string, value: string): string {
  return foldIcalLine(`${name}:${value}`);
}

export function buildVEvent(
  ev: IcsEventInput,
  dtStamp: Date,
): string {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(property("UID", ev.uid));
  lines.push(property("DTSTAMP", formatIcalDateUtc(dtStamp)));
  lines.push(property("DTSTART", formatIcalDateUtc(ev.startTime)));
  lines.push(property("DTEND", formatIcalDateUtc(ev.endTime)));
  lines.push(property("SUMMARY", escapeIcalText(ev.summary)));
  if (ev.description != null && ev.description.length > 0) {
    lines.push(property("DESCRIPTION", escapeIcalText(ev.description)));
  }
  if (ev.location != null && ev.location.length > 0) {
    lines.push(property("LOCATION", escapeIcalText(ev.location)));
  }
  lines.push(property("SEQUENCE", "0"));
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/**
 * Full VCALENDAR document (CRLF). Empty events array yields valid calendar with no VEVENTs.
 */
export function buildVCalendar(events: IcsEventInput[], dtStamp = new Date()): string {
  const blocks = events.map((ev) => buildVEvent(ev, dtStamp));
  const inner = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BoilerBridge//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...blocks,
    "END:VCALENDAR",
  ].join("\r\n");
  return inner + "\r\n";
}

/** Google Calendar “template” URL — one event at a time; bulk use .ics */
export function buildGoogleCalendarTemplateUrl(ev: {
  title: string;
  startTime: Date;
  endTime: Date;
  description?: string;
  location?: string;
}): string {
  const text = ev.title;
  const dates = `${formatIcalDateUtc(ev.startTime)}/${formatIcalDateUtc(ev.endTime)}`;
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", text);
  u.searchParams.set("dates", dates);
  if (ev.description) u.searchParams.set("details", ev.description);
  if (ev.location) u.searchParams.set("location", ev.location);
  return u.toString();
}

/** Safe filename segment from group name */
export function slugifyGroupFilename(name: string): string {
  return (
    name
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "group"
  );
}

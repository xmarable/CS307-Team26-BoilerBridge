import {
  escapeIcalText,
  formatIcalDateUtc,
  buildVCalendar,
  buildGoogleCalendarTemplateUrl,
  slugifyGroupFilename,
  foldIcalLine,
} from "@/lib/icalendar";

describe("escapeIcalText", () => {
  it("escapes backslash, semicolon, comma, newline", () => {
    expect(escapeIcalText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
  });
});

describe("formatIcalDateUtc", () => {
  it("formats UTC instant", () => {
    const d = new Date("2026-06-04T14:30:00.000Z");
    expect(formatIcalDateUtc(d)).toBe("20260604T143000Z");
  });
});

describe("buildVCalendar", () => {
  it("returns valid structure with no events", () => {
    const ics = buildVCalendar([], new Date("2026-01-01T00:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//BoilerBridge//EN");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("includes one VEVENT with UID and times in UTC", () => {
    const ics = buildVCalendar(
      [
        {
          uid: "abc-123@boilerbridge.local",
          startTime: new Date("2026-06-01T10:00:00.000Z"),
          endTime: new Date("2026-06-01T11:00:00.000Z"),
          summary: "Brunch",
          description: "Notes here",
          location: "Paris",
        },
      ],
      new Date("2026-05-01T12:00:00.000Z"),
    );
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:abc-123@boilerbridge.local");
    expect(ics).toContain("DTSTART:20260601T100000Z");
    expect(ics).toContain("DTEND:20260601T110000Z");
    expect(ics).toContain("SUMMARY:Brunch");
    expect(ics).toContain("LOCATION:Paris");
    expect(ics).toContain("END:VEVENT");
  });
});

describe("buildGoogleCalendarTemplateUrl", () => {
  it("includes calendar.google.com and TEMPLATE params", () => {
    const url = buildGoogleCalendarTemplateUrl({
      title: "Meet",
      startTime: new Date("2026-01-15T15:00:00.000Z"),
      endTime: new Date("2026-01-15T16:00:00.000Z"),
      description: "Desc",
      location: "Here",
    });
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=Meet");
    expect(url).toContain("dates=20260115T150000Z%2F20260115T160000Z");
  });
});

describe("slugifyGroupFilename", () => {
  it("sanitizes group name", () => {
    expect(slugifyGroupFilename("My Trip Group!")).toBe("My-Trip-Group");
  });
});

describe("foldIcalLine", () => {
  it("returns short line unchanged", () => {
    expect(foldIcalLine("SUMMARY:Hi")).toBe("SUMMARY:Hi");
  });
});

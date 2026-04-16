export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export function getZonedParts(d: Date, timeZone: string): ZonedParts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = f.formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

export function zonedDayKey(d: Date, timeZone: string): string {
  const p = getZonedParts(d, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Returns a UTC instant whose calendar + clock in `timeZone` equals the given parts.
 */
export function utcForZonedWallClock(
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 56; i++) {
    const p = getZonedParts(new Date(guess), timeZone);
    if (
      p.year === year &&
      p.month === month &&
      p.day === day &&
      p.hour === hour &&
      p.minute === minute
    ) {
      return new Date(guess);
    }
    const dYear = year - p.year;
    const dMonth = month - p.month;
    const dDay = day - p.day;
    const dHour = hour - p.hour;
    const dMin = minute - p.minute;
    guess +=
      (((dYear * 12 + dMonth) * 31 + dDay) * 24 + dHour) * 60 * 60 * 1000 +
      dMin * 60 * 1000;
  }
  return new Date(guess);
}

export function minutesSinceMidnightInZone(d: Date, timeZone: string): number {
  const p = getZonedParts(d, timeZone);
  return p.hour * 60 + p.minute;
}

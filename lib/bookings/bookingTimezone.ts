export const BOOKING_TIMEZONE = "Europe/Bucharest";

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(
  date: Date,
  timeZone: string = BOOKING_TIMEZONE,
): ZonedParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  let hour = get("hour");
  if (hour === 24) hour = 0;

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

export function formatDateInBookingTimezone(
  date: Date,
  timeZone: string = BOOKING_TIMEZONE,
): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function addDaysToDateString(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function getTodayInBookingTimezone(now: Date = new Date()): string {
  return formatDateInBookingTimezone(now);
}

export function zonedDateTimeToUtcMs(
  date: string,
  time: string,
  timeZone: string = BOOKING_TIMEZONE,
): number {
  const [y, m, d] = date.split("-").map(Number);
  const normalized = time.slice(0, 5);
  const [h, min] = normalized.split(":").map(Number);

  let utcMs = Date.UTC(y, m - 1, d, h, min, 0);

  for (let i = 0; i < 4; i++) {
    const zoned = getZonedParts(new Date(utcMs), timeZone);
    const zonedAsUtc = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    );
    const desiredAsUtc = Date.UTC(y, m - 1, d, h, min, 0);
    const diff = desiredAsUtc - zonedAsUtc;
    if (diff === 0) break;
    utcMs += diff;
  }

  return utcMs;
}

export function parseBookingDateTime(date: string, startTime: string): Date {
  return new Date(zonedDateTimeToUtcMs(date, startTime));
}

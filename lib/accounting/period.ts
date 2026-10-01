import {
  addDaysToDateString,
  BOOKING_TIMEZONE,
  zonedDateTimeToUtcMs,
} from "@/lib/bookings/bookingTimezone";

/** Contabilitatea Frizeo folosește același fus ca programările: Europe/Bucharest. */
export const ACCOUNTING_TIMEZONE = BOOKING_TIMEZONE;

/** O lună lungă plus un an bisect. Protejează funcția on-demand de pe Vercel Hobby. */
export const MAX_ACCOUNTING_RANGE_DAYS = 366;

/**
 * InvoicePayment este creat la finalizarea invoice-ului, iar încasarea poate veni
 * după retry-urile Stripe. Lookback-ul leagă charge-ul de invoice fără să mute
 * plată în luna greșită: data raportului rămâne `charge.created`.
 */
export const INVOICE_PAYMENT_LOOKBACK_SECONDS = 45 * 24 * 60 * 60;

export type AccountingPeriod = {
  from: string;
  to: string;
  timeZone: typeof ACCOUNTING_TIMEZONE;
  /** Inclusiv, secunde Unix. Miezul nopții din Europe/Bucharest. */
  startUnix: number;
  /** Exclusiv, secunde Unix. Miezul nopții de după `to`, în Europe/Bucharest. */
  endUnix: number;
};

export type AccountingQuery =
  | { ok: true; period: AccountingPeriod }
  | { ok: false; error: string };

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year &&
    utc.getUTCMonth() === month - 1 &&
    utc.getUTCDate() === day
  );
}

function isIsoMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const [year, month] = value.split("-").map(Number);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
}

export function inclusiveCalendarDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function lastDateOfMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth =
    monthNumber === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
  return addDaysToDateString(nextMonth, -1);
}

export function currentMonthInBucharest(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ACCOUNTING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function unixSeconds(date: string, time: string): number {
  return Math.floor(zonedDateTimeToUtcMs(date, time, ACCOUNTING_TIMEZONE) / 1000);
}

export function periodFromCivilDates(from: string, to: string): AccountingQuery {
  if (!isIsoDate(from) || !isIsoDate(to)) {
    return { ok: false, error: "Interval invalid. Folosește date calendaristice valide." };
  }
  if (from > to) {
    return { ok: false, error: "Data de început este după data de sfârșit." };
  }
  if (inclusiveCalendarDays(from, to) > MAX_ACCOUNTING_RANGE_DAYS) {
    return {
      ok: false,
      error: `Intervalul poate avea cel mult ${MAX_ACCOUNTING_RANGE_DAYS} de zile.`,
    };
  }

  return {
    ok: true,
    period: {
      from,
      to,
      timeZone: ACCOUNTING_TIMEZONE,
      startUnix: unixSeconds(from, "00:00"),
      endUnix: unixSeconds(addDaysToDateString(to, 1), "00:00"),
    },
  };
}

export function periodFromMonth(month: string): AccountingQuery {
  if (!isIsoMonth(month)) {
    return { ok: false, error: "Luna este invalidă. Folosește formatul YYYY-MM." };
  }
  return periodFromCivilDates(`${month}-01`, lastDateOfMonth(month));
}

export function parseAccountingQuery(
  params: URLSearchParams,
  now: Date = new Date(),
): AccountingQuery {
  const from = params.get("from")?.trim() ?? "";
  const to = params.get("to")?.trim() ?? "";
  const month = params.get("month")?.trim() ?? "";

  if (from || to) {
    if (!from || !to) {
      return { ok: false, error: "Completează ambele date: De la și Până la." };
    }
    return periodFromCivilDates(from, to);
  }

  if (month) return periodFromMonth(month);
  return periodFromMonth(currentMonthInBucharest(now));
}

export function isInAccountingPeriod(
  unixSecondsValue: number,
  period: Pick<AccountingPeriod, "startUnix" | "endUnix">,
): boolean {
  return unixSecondsValue >= period.startUnix && unixSecondsValue < period.endUnix;
}

type ZonedParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
};

function bucharestParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ACCOUNTING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
  };
}

export function formatBucharestDate(unixSecondsValue: number): string {
  const parts = bucharestParts(new Date(unixSecondsValue * 1000));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatBucharestDateTime(date: Date): string {
  const parts = bucharestParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

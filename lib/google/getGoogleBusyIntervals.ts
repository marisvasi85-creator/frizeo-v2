import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOOKING_TIMEZONE,
  addDaysToDateString,
  zonedDateTimeToUtcMs,
} from "@/lib/bookings/bookingTimezone";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";
import { queryFreeBusy } from "@/lib/google/queryFreeBusy";
import { minutesToTime, timeToMinutes } from "@/lib/schedule/time";

export type BusyInterval = {
  start: string;
  end: string;
};

function formatTimeInBookingTimezone(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKING_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  return minutesToTime(hour * 60 + minute);
}

function busyBlockToInterval(
  blockStart: string,
  blockEnd: string,
  date: string,
): BusyInterval | null {
  const dayStartMs = zonedDateTimeToUtcMs(date, "00:00");
  const dayEndMs = zonedDateTimeToUtcMs(date, "23:59") + 59 * 1000;

  const startMs = new Date(blockStart).getTime();
  const endMs = new Date(blockEnd).getTime();

  if (endMs <= dayStartMs || startMs >= dayEndMs) {
    return null;
  }

  const clippedStartMs = Math.max(startMs, dayStartMs);
  const clippedEndMs = Math.min(endMs, dayEndMs + 1);

  const start = formatTimeInBookingTimezone(new Date(clippedStartMs));
  const end = formatTimeInBookingTimezone(new Date(clippedEndMs));

  if (timeToMinutes(start) >= timeToMinutes(end)) {
    return null;
  }

  return { start, end };
}

export async function getGoogleBusyIntervalsForDate(
  supabase: SupabaseClient,
  barberId: string,
  date: string,
): Promise<BusyInterval[]> {
  const auth = await getAccessTokenForBarber(supabase, barberId);
  if (!auth) {
    return [];
  }

  const timeMin = new Date(zonedDateTimeToUtcMs(date, "00:00")).toISOString();
  const timeMax = new Date(
    zonedDateTimeToUtcMs(date, "23:59") + 59 * 1000,
  ).toISOString();

  const busyBlocks = await queryFreeBusy({
    accessToken: auth.accessToken,
    calendarId: auth.calendarId,
    timeMin,
    timeMax,
  });

  return busyBlocks
    .map((block) => busyBlockToInterval(block.start, block.end, date))
    .filter((interval): interval is BusyInterval => interval !== null);
}

export async function getGoogleBusyIntervalsByDate(
  supabase: SupabaseClient,
  barberId: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, BusyInterval[]>> {
  const auth = await getAccessTokenForBarber(supabase, barberId);
  if (!auth) {
    return {};
  }

  const timeMin = new Date(
    zonedDateTimeToUtcMs(fromDate, "00:00"),
  ).toISOString();
  const timeMax = new Date(
    zonedDateTimeToUtcMs(toDate, "23:59") + 59 * 1000,
  ).toISOString();

  const busyBlocks = await queryFreeBusy({
    accessToken: auth.accessToken,
    calendarId: auth.calendarId,
    timeMin,
    timeMax,
  });

  const byDate: Record<string, BusyInterval[]> = {};
  let current = fromDate;

  while (current <= toDate) {
    byDate[current] = busyBlocks
      .map((block) => busyBlockToInterval(block.start, block.end, current))
      .filter((interval): interval is BusyInterval => interval !== null);
    current = addDaysToDateString(current, 1);
  }

  return byDate;
}

export function slotOverlapsBusyIntervals(
  slotStart: string,
  slotEnd: string,
  busyIntervals: BusyInterval[],
): boolean {
  const slotStartMin = timeToMinutes(slotStart);
  const slotEndMin = timeToMinutes(slotEnd);

  return busyIntervals.some((interval) => {
    const intervalStart = timeToMinutes(interval.start);
    const intervalEnd = timeToMinutes(interval.end);
    return slotStartMin < intervalEnd && slotEndMin > intervalStart;
  });
}

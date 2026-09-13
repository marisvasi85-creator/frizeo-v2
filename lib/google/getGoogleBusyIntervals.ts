import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BOOKING_TIMEZONE,
  addDaysToDateString,
  zonedDateTimeToUtcMs,
} from "@/lib/bookings/bookingTimezone";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";
import { queryFreeBusy } from "@/lib/google/queryFreeBusy";
import { subtractBusyIntervals } from "@/lib/schedule/subtractBusyIntervals";
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

const RELEASED_BOOKING_STATUSES = ["cancelled", "completed", "no_show"];

function bookingDateKey(value: string): string {
  return String(value).slice(0, 10);
}

async function getReleasedBookingIntervalsByDate(
  supabase: SupabaseClient,
  barberId: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, BusyInterval[]>> {
  const { data, error } = await supabase
    .from("bookings")
    .select("date, start_time, end_time")
    .eq("barber_id", barberId)
    .in("status", RELEASED_BOOKING_STATUSES)
    .gte("date", fromDate)
    .lte("date", toDate);

  if (error) {
    console.error("RELEASED BOOKING INTERVALS ERROR:", error);
    return {};
  }

  const byDate: Record<string, BusyInterval[]> = {};
  for (const row of data ?? []) {
    const date = bookingDateKey(row.date);
    const start = String(row.start_time).slice(0, 5);
    const end = String(row.end_time).slice(0, 5);
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({ start, end });
  }
  return byDate;
}

async function loadGoogleBusyIntervalsForDate(
  supabase: SupabaseClient,
  barberId: string,
  date: string,
): Promise<BusyInterval[]> {
  const auth = await getAccessTokenForBarber(supabase, barberId);
  if (!auth) {
    return [];
  }

  // Do not delete leftover Google events here. Public /api/availability
  // and /api/slots await this helper; sequential DELETE/PATCH of cancelled
  // events times out the calendar and looks like "no public slots".
  // subtractBusyIntervals already punches cancelled Frizeo bookings out
  // of FreeBusy for display and hold checks.

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

  const busy = busyBlocks
    .map((block) => busyBlockToInterval(block.start, block.end, date))
    .filter((interval): interval is BusyInterval => interval !== null);

  const released = await getReleasedBookingIntervalsByDate(
    supabase,
    barberId,
    date,
    date,
  );

  return subtractBusyIntervals(busy, released[date] ?? []);
}

export async function getGoogleBusyIntervalsForDate(
  supabase: SupabaseClient,
  barberId: string,
  date: string,
): Promise<BusyInterval[]> {
  try {
    return await loadGoogleBusyIntervalsForDate(supabase, barberId, date);
  } catch (err) {
    console.error("GOOGLE BUSY INTERVALS ERROR:", err);
    return [];
  }
}

async function loadGoogleBusyIntervalsByDate(
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

  const releasedByDate = await getReleasedBookingIntervalsByDate(
    supabase,
    barberId,
    fromDate,
    toDate,
  );

  const byDate: Record<string, BusyInterval[]> = {};
  let current = fromDate;

  while (current <= toDate) {
    const busy = busyBlocks
      .map((block) => busyBlockToInterval(block.start, block.end, current))
      .filter((interval): interval is BusyInterval => interval !== null);
    byDate[current] = subtractBusyIntervals(
      busy,
      releasedByDate[current] ?? [],
    );
    current = addDaysToDateString(current, 1);
  }

  return byDate;
}

export async function getGoogleBusyIntervalsByDate(
  supabase: SupabaseClient,
  barberId: string,
  fromDate: string,
  toDate: string,
): Promise<Record<string, BusyInterval[]>> {
  try {
    return await loadGoogleBusyIntervalsByDate(
      supabase,
      barberId,
      fromDate,
      toDate,
    );
  } catch (err) {
    console.error("GOOGLE BUSY INTERVALS ERROR:", err);
    return {};
  }
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

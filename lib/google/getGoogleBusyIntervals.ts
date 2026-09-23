import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToDateString, zonedDateTimeToUtcMs } from "@/lib/bookings/bookingTimezone";
import {
  busyRangeToInterval,
  calendarEventsToBusyIntervals,
  type BusyInterval,
} from "@/lib/google/calendarBusy";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";
import { listBusyCalendarEvents } from "@/lib/google/listCalendarEvents";
import { queryFreeBusy } from "@/lib/google/queryFreeBusy";
import { subtractBusyIntervals } from "@/lib/schedule/subtractBusyIntervals";
import { timeToMinutes } from "@/lib/schedule/time";

export type { BusyInterval } from "@/lib/google/calendarBusy";

const RELEASED_BOOKING_STATUSES = ["cancelled", "completed", "no_show"];

function bookingDateKey(value: string): string {
  return String(value).slice(0, 10);
}

type ReleasedBookings = {
  eventIds: Set<string>;
  intervalsByDate: Record<string, BusyInterval[]>;
};

async function getReleasedBookings(
  supabase: SupabaseClient,
  barberId: string,
  fromDate: string,
  toDate: string,
): Promise<ReleasedBookings> {
  const { data, error } = await supabase
    .from("bookings")
    .select("date, start_time, end_time, google_event_id")
    .eq("barber_id", barberId)
    .in("status", RELEASED_BOOKING_STATUSES)
    .gte("date", fromDate)
    .lte("date", toDate);

  if (error) {
    console.error("RELEASED BOOKING INTERVALS ERROR:", error);
    return { eventIds: new Set(), intervalsByDate: {} };
  }

  const eventIds = new Set<string>();
  const intervalsByDate: Record<string, BusyInterval[]> = {};

  for (const row of data ?? []) {
    const eventId = String(row.google_event_id || "").trim();
    if (eventId) eventIds.add(eventId);

    const date = bookingDateKey(row.date);
    const start = String(row.start_time).slice(0, 5);
    const end = String(row.end_time).slice(0, 5);
    if (!intervalsByDate[date]) intervalsByDate[date] = [];
    intervalsByDate[date].push({ start, end });
  }

  return { eventIds, intervalsByDate };
}

function busyBlocksToIntervals(
  busyBlocks: { start: string; end: string }[],
  date: string,
): BusyInterval[] {
  return busyBlocks
    .map((block) => busyRangeToInterval(block.start, block.end, date))
    .filter((interval): interval is BusyInterval => interval !== null);
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
  // events.list skips leftover Frizeo rows by google_event_id so a personal
  // event on the same hour still blocks public booking.

  const timeMin = new Date(zonedDateTimeToUtcMs(date, "00:00")).toISOString();
  const timeMax = new Date(
    zonedDateTimeToUtcMs(date, "23:59") + 59 * 1000,
  ).toISOString();

  const released = await getReleasedBookings(supabase, barberId, date, date);

  const events = await listBusyCalendarEvents({
    accessToken: auth.accessToken,
    calendarId: auth.calendarId,
    timeMin,
    timeMax,
  });

  if (events) {
    return calendarEventsToBusyIntervals(events, date, released.eventIds);
  }

  const busyBlocks = await queryFreeBusy({
    accessToken: auth.accessToken,
    calendarId: auth.calendarId,
    timeMin,
    timeMax,
  });

  return subtractBusyIntervals(
    busyBlocksToIntervals(busyBlocks, date),
    released.intervalsByDate[date] ?? [],
  );
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

  const released = await getReleasedBookings(
    supabase,
    barberId,
    fromDate,
    toDate,
  );

  const events = await listBusyCalendarEvents({
    accessToken: auth.accessToken,
    calendarId: auth.calendarId,
    timeMin,
    timeMax,
  });

  const byDate: Record<string, BusyInterval[]> = {};
  let current = fromDate;

  if (events) {
    while (current <= toDate) {
      byDate[current] = calendarEventsToBusyIntervals(
        events,
        current,
        released.eventIds,
      );
      current = addDaysToDateString(current, 1);
    }
    return byDate;
  }

  const busyBlocks = await queryFreeBusy({
    accessToken: auth.accessToken,
    calendarId: auth.calendarId,
    timeMin,
    timeMax,
  });

  while (current <= toDate) {
    byDate[current] = subtractBusyIntervals(
      busyBlocksToIntervals(busyBlocks, current),
      released.intervalsByDate[current] ?? [],
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

/**
 * Marketing copy must not treat a Google outage as "no busy time".
 * Not connected → empty intervals. Request failure → ok: false.
 */
export async function getGoogleBusyIntervalsByDateStrict(
  supabase: SupabaseClient,
  barberId: string,
  fromDate: string,
  toDate: string,
): Promise<
  { ok: true; byDate: Record<string, BusyInterval[]> } | { ok: false }
> {
  try {
    const auth = await getAccessTokenForBarber(supabase, barberId);
    if (!auth) return { ok: true, byDate: {} };
    const byDate = await loadGoogleBusyIntervalsByDate(
      supabase,
      barberId,
      fromDate,
      toDate,
    );
    return { ok: true, byDate };
  } catch (err) {
    console.error("GOOGLE BUSY INTERVALS ERROR:", err);
    return { ok: false };
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

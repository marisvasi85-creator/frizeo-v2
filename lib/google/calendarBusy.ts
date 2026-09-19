import {
  BOOKING_TIMEZONE,
  zonedDateTimeToUtcMs,
} from "@/lib/bookings/bookingTimezone";
import { minutesToTime, timeToMinutes } from "@/lib/schedule/time";

export type BusyInterval = {
  start: string;
  end: string;
};

export type GoogleCalendarEvent = {
  id?: string | null;
  status?: string | null;
  transparency?: string | null;
  eventType?: string | null;
  attendees?: Array<{
    self?: boolean | null;
    responseStatus?: string | null;
  }> | null;
  start?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;
  end?: {
    dateTime?: string | null;
    date?: string | null;
  } | null;
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

/**
 * Clip a UTC/RFC3339 busy range onto one booking-timezone civil date.
 */
export function busyRangeToInterval(
  blockStart: string,
  blockEnd: string,
  date: string,
): BusyInterval | null {
  const dayStartMs = zonedDateTimeToUtcMs(date, "00:00");
  const dayEndMs = zonedDateTimeToUtcMs(date, "23:59") + 59 * 1000;

  const startMs = new Date(blockStart).getTime();
  const endMs = new Date(blockEnd).getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return null;
  }

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

export function googleEventTimeBounds(
  event: GoogleCalendarEvent,
): { start: string; end: string } | null {
  const startDateTime = event.start?.dateTime;
  const endDateTime = event.end?.dateTime;
  if (startDateTime && endDateTime) {
    return { start: startDateTime, end: endDateTime };
  }

  const startDate = event.start?.date;
  const endDate = event.end?.date;
  if (startDate && endDate) {
    return {
      start: new Date(zonedDateTimeToUtcMs(startDate, "00:00")).toISOString(),
      end: new Date(zonedDateTimeToUtcMs(endDate, "00:00")).toISOString(),
    };
  }

  return null;
}

function selfDeclined(event: GoogleCalendarEvent): boolean {
  const self = event.attendees?.find((attendee) => attendee.self);
  return self?.responseStatus === "declined";
}

/**
 * Personal Google events must block public booking even when marked
 * "Show as free" / transparent. The Calendar UI still occupies the hour,
 * and FreeBusy would otherwise treat that as an open slot.
 *
 * Working locations and declined invites do not mean the barber is booked.
 * Leftover Frizeo events from released bookings are skipped by event id,
 * not by punching their time out of every overlapping busy block.
 */
export function calendarEventBlocksBooking(
  event: GoogleCalendarEvent,
  releasedEventIds: Set<string>,
): boolean {
  const eventId = event.id?.trim();
  if (eventId && releasedEventIds.has(eventId)) {
    return false;
  }

  if (event.status === "cancelled") {
    return false;
  }

  if (event.eventType === "workingLocation") {
    return false;
  }

  if (selfDeclined(event)) {
    return false;
  }

  return Boolean(googleEventTimeBounds(event));
}

export function calendarEventsToBusyIntervals(
  events: GoogleCalendarEvent[],
  date: string,
  releasedEventIds: Set<string> = new Set(),
): BusyInterval[] {
  const intervals: BusyInterval[] = [];

  for (const event of events) {
    if (!calendarEventBlocksBooking(event, releasedEventIds)) continue;
    const bounds = googleEventTimeBounds(event);
    if (!bounds) continue;
    const interval = busyRangeToInterval(bounds.start, bounds.end, date);
    if (interval) intervals.push(interval);
  }

  return intervals;
}

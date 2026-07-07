import { getSlotEligibility } from "@/lib/bookings/bookingLeadTime";
import type { BusyInterval } from "@/lib/google/getGoogleBusyIntervals";
import { slotOverlapsBusyIntervals } from "@/lib/google/getGoogleBusyIntervals";
import { getActiveBookings } from "@/lib/schedule/bookings";
import type { ResolvedDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import { minutesToTime, timeToMinutes } from "@/lib/schedule/time";

type BookingRow = {
  id?: string;
  start_time: string;
  end_time: string;
  status: string;
  expires_at?: string | null;
};

export function generatePublicFreeSlots({
  date,
  resolved,
  duration,
  bookings,
  googleBusyIntervals,
  minNoticeHours,
  now = new Date(),
  excludeBookingId,
}: {
  date: string;
  resolved: ResolvedDaySchedule;
  duration: number;
  bookings: BookingRow[];
  googleBusyIntervals: BusyInterval[];
  minNoticeHours: number;
  now?: Date;
  excludeBookingId?: string | null;
}): string[] {
  if (!resolved.isWorking || !resolved.workStart || !resolved.workEnd) {
    return [];
  }

  const start = timeToMinutes(resolved.workStart);
  const end = timeToMinutes(resolved.workEnd);

  const breakStart =
    resolved.breakEnabled && resolved.breakStart
      ? timeToMinutes(resolved.breakStart)
      : null;
  const breakEnd =
    resolved.breakEnabled && resolved.breakEnd
      ? timeToMinutes(resolved.breakEnd)
      : null;

  const activeBookings = getActiveBookings(bookings, now).filter(
    (booking) => booking.id !== excludeBookingId,
  );

  function generateRange(startMin: number, endMin: number): string[] {
    const free: string[] = [];

    for (let t = startMin; t + duration <= endMin; t += duration) {
      const slotStart = t;
      const slotEnd = t + duration;

      const booking = activeBookings.find((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        return slotStart < bEnd && slotEnd > bStart;
      });

      if (booking) continue;

      if (breakStart !== null && breakEnd !== null) {
        const overlapsBreak = slotStart < breakEnd && slotEnd > breakStart;
        if (overlapsBreak) continue;
      }

      const slotTime = minutesToTime(t);
      const slotEndTime = minutesToTime(slotEnd);

      if (
        slotOverlapsBusyIntervals(slotTime, slotEndTime, googleBusyIntervals)
      ) {
        continue;
      }

      const eligibility = getSlotEligibility({
        date,
        startTime: slotTime,
        minNoticeHours,
        now,
        bypassMinNotice: false,
      });

      if (!eligibility.eligible) continue;

      free.push(slotTime);
    }

    return free;
  }

  if (breakStart === null || breakEnd === null) {
    return generateRange(start, end);
  }

  return [...generateRange(start, breakStart), ...generateRange(breakEnd, end)];
}

import { addDaysToDateString } from "@/lib/bookings/bookingTimezone";
import {
  resolveDaySchedule,
  type DayOverrideRow,
  type WeeklyScheduleRow,
} from "@/lib/schedule/resolveDaySchedule";
import { jsDayToScheduleDay, timeToMinutes } from "@/lib/schedule/time";

export type OccupancyScheduleRow = WeeklyScheduleRow & {
  barber_id: string;
  day_of_week: number;
};

export type OccupancyOverrideRow = DayOverrideRow & {
  barber_id: string;
  date: string;
};

export type OccupancyBookingRow = {
  barber_id: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
};

export type OccupancyMetrics = {
  /** Confirmed booking minutes in range. */
  bookedMinutes: number;
  /** Working minutes from schedule (minus breaks / closed days). */
  availableMinutes: number;
  /** 0–100, or null when schedule has no available time. */
  occupancyPercent: number | null;
};

export function eachDateInclusive(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = addDaysToDateString(current, 1);
  }
  return dates;
}

export function workingMinutesFromSchedule(input: {
  isWorking: boolean;
  workStart: string | null;
  workEnd: string | null;
  breakEnabled: boolean;
  breakStart: string | null;
  breakEnd: string | null;
}): number {
  if (!input.isWorking || !input.workStart || !input.workEnd) return 0;

  let minutes =
    timeToMinutes(input.workEnd) - timeToMinutes(input.workStart);
  if (minutes <= 0) return 0;

  if (input.breakEnabled && input.breakStart && input.breakEnd) {
    const breakMinutes =
      timeToMinutes(input.breakEnd) - timeToMinutes(input.breakStart);
    if (breakMinutes > 0) minutes -= breakMinutes;
  }

  return Math.max(0, minutes);
}

export function bookingDurationMinutes(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number {
  if (!startTime || !endTime) return 0;
  const minutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return minutes > 0 ? minutes : 0;
}

/**
 * Occupancy = confirmed booking minutes / scheduled working minutes.
 * Closed days, breaks, and day overrides are respected.
 */
export function computeOccupancyMetrics(input: {
  from: string;
  to: string;
  barberIds: string[];
  weekly: OccupancyScheduleRow[];
  overrides: OccupancyOverrideRow[];
  bookings: OccupancyBookingRow[];
}): OccupancyMetrics {
  const barberIdSet = new Set(input.barberIds);
  const dates = eachDateInclusive(input.from, input.to);

  const weeklyByBarberDay = new Map<string, OccupancyScheduleRow>();
  for (const row of input.weekly) {
    if (!barberIdSet.has(row.barber_id)) continue;
    weeklyByBarberDay.set(`${row.barber_id}:${row.day_of_week}`, row);
  }

  const overrideByBarberDate = new Map<string, OccupancyOverrideRow>();
  for (const row of input.overrides) {
    if (!barberIdSet.has(row.barber_id)) continue;
    overrideByBarberDate.set(`${row.barber_id}:${row.date}`, row);
  }

  let availableMinutes = 0;
  for (const barberId of input.barberIds) {
    for (const date of dates) {
      const dayOfWeek = jsDayToScheduleDay(date);
      const weekly = weeklyByBarberDay.get(`${barberId}:${dayOfWeek}`);
      const override = overrideByBarberDate.get(`${barberId}:${date}`);
      const resolved = resolveDaySchedule(weekly, override);
      availableMinutes += workingMinutesFromSchedule(resolved);
    }
  }

  let bookedMinutes = 0;
  for (const booking of input.bookings) {
    if (booking.status !== "confirmed") continue;
    if (!booking.barber_id || !barberIdSet.has(booking.barber_id)) continue;
    bookedMinutes += bookingDurationMinutes(
      booking.start_time,
      booking.end_time,
    );
  }

  if (availableMinutes <= 0) {
    return {
      bookedMinutes,
      availableMinutes: 0,
      occupancyPercent: null,
    };
  }

  const rawPercent = (bookedMinutes / availableMinutes) * 100;
  const occupancyPercent = Math.min(100, Math.max(0, Math.round(rawPercent)));

  return {
    bookedMinutes,
    availableMinutes,
    occupancyPercent,
  };
}

export function formatOccupancyHint(
  metrics: Pick<OccupancyMetrics, "bookedMinutes" | "availableMinutes">,
): string | undefined {
  if (metrics.availableMinutes <= 0) return undefined;
  const bookedHours = metrics.bookedMinutes / 60;
  const availableHours = metrics.availableMinutes / 60;
  const formatHours = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${formatHours(bookedHours)}h din ${formatHours(availableHours)}h program`;
}

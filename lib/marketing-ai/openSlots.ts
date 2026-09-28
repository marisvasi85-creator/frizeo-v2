import type { BusyInterval } from "@/lib/google/getGoogleBusyIntervals";
import { getActiveBookings } from "@/lib/schedule/bookings";
import { generatePublicFreeSlots } from "@/lib/schedule/generatePublicFreeSlots";
import {
  resolveDaySchedule,
  type DayOverrideRow,
  type ScheduleMode,
  type WeeklyScheduleRow,
} from "@/lib/schedule/resolveDaySchedule";
import { jsDayToScheduleDay } from "@/lib/schedule/time";
import type { OpenSlotDayFact } from "./types";

const WEEKDAYS = [
  "duminică",
  "luni",
  "marți",
  "miercuri",
  "joi",
  "vineri",
  "sâmbătă",
];

export type OpenSlotBooking = {
  id?: string;
  start_time: string;
  end_time: string;
  status: string;
  expires_at?: string | null;
};

export type OpenSlotDaySource = {
  date: string;
  scheduleMode: ScheduleMode;
  weekly: WeeklyScheduleRow | null;
  override: DayOverrideRow | null;
  bookings: OpenSlotBooking[];
  googleBusy: BusyInterval[];
  /** Null uses the day's slot duration, then 15 — same fallback as public slots. */
  durationMinutes: number | null;
  minNoticeHours: number;
  now: Date;
};

export function weekdayLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAYS[jsDay] || date;
}

export function countFreeSlotsForDay(input: OpenSlotDaySource): {
  closed: boolean;
  freeCount: number;
  sampleTimes: string[];
} {
  const resolved = resolveDaySchedule(
    input.weekly,
    input.override,
    input.scheduleMode,
  );
  if (!resolved.isWorking || !resolved.workStart || !resolved.workEnd) {
    return { closed: true, freeCount: 0, sampleTimes: [] };
  }

  if (!input.durationMinutes || input.durationMinutes <= 0) {
    return { closed: false, freeCount: 0, sampleTimes: [] };
  }

  const duration = input.durationMinutes;
  const free = generatePublicFreeSlots({
    date: input.date,
    resolved,
    duration,
    bookings: getActiveBookings(input.bookings, input.now),
    googleBusyIntervals: input.googleBusy,
    minNoticeHours: input.minNoticeHours,
    now: input.now,
  });

  return {
    closed: false,
    freeCount: free.length,
    sampleTimes: free.slice(0, 3),
  };
}

export function summarizeOpenDays(days: OpenSlotDaySource[]): OpenSlotDayFact[] {
  const facts: OpenSlotDayFact[] = [];
  for (const day of days) {
    const counted = countFreeSlotsForDay(day);
    if (counted.closed || counted.freeCount <= 0) continue;
    facts.push({
      date: day.date,
      weekday: weekdayLabel(day.date),
      freeCount: counted.freeCount,
      sampleTimes: counted.sampleTimes,
      durationMinutes: day.durationMinutes,
    });
  }
  return facts;
}

export function scheduleDayForDate(date: string): number {
  return jsDayToScheduleDay(date);
}

/** One duration means every active service books the same appointment length. */
export function appointmentDurationMinutes(
  selectedDuration: number | null,
  serviceDurations: number[],
): number | null {
  if (selectedDuration != null && selectedDuration > 0) return selectedDuration;
  const unique = [
    ...new Set(serviceDurations.filter((duration) => duration > 0)),
  ];
  return unique.length === 1 ? unique[0] : null;
}

/**
 * Days with at least one bookable appointment.
 * The count is included only when every considered service shares one duration,
 * matching the public slot list for that duration.
 */
export function buildOpenSlotFacts(
  days: OpenSlotDaySource[],
  serviceDurations: number[],
): OpenSlotDayFact[] {
  const duration = appointmentDurationMinutes(
    days.find((day) => day.durationMinutes && day.durationMinutes > 0)?.durationMinutes ?? null,
    serviceDurations,
  );

  if (duration != null) {
    return summarizeOpenDays(
      days.map((day) => ({ ...day, durationMinutes: duration })),
    );
  }

  const unique = [
    ...new Set(serviceDurations.filter((value) => value > 0)),
  ];
  if (!unique.length) return [];

  const facts: OpenSlotDayFact[] = [];
  for (const day of days) {
    const open = unique.some((serviceDuration) => {
      const counted = countFreeSlotsForDay({
        ...day,
        durationMinutes: serviceDuration,
      });
      return !counted.closed && counted.freeCount > 0;
    });
    if (!open) continue;
    facts.push({
      date: day.date,
      weekday: weekdayLabel(day.date),
      freeCount: null,
      sampleTimes: [],
      durationMinutes: null,
    });
  }
  return facts;
}

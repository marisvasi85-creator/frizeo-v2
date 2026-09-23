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

  const duration = input.durationMinutes ?? resolved.slotDuration ?? 15;
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
    });
  }
  return facts;
}

export function scheduleDayForDate(date: string): number {
  return jsDayToScheduleDay(date);
}

export function formatOpenSlotFacts(facts: OpenSlotDayFact[]): string {
  if (!facts.length) return "Niciun loc liber în următoarele 7 zile.";
  return facts
    .map(
      (fact) =>
        `${fact.weekday} ${fact.date}: ${fact.freeCount} locuri libere (exemple: ${fact.sampleTimes.join(", ")})`,
    )
    .join("\n");
}

import { generateSlots } from "./generateSlots";
import { isSlotFree } from "./isSlotFree";
import { toISO, getDayOfWeek } from "./time-utils";
import type { Booking } from "./types";

type Schedule = {
  day_of_week: number;
  is_working: boolean;
  work_start: string;
  work_end: string;
};

type Override = {
  date: string;
  is_closed: boolean;
  work_start?: string;
  work_end?: string;
};

export function getAvailableSlots({
  date,
  duration,
  bookings,
  schedule,
  overrides,
}: {
  date: string;
  duration: number;
  bookings: Booking[];
  schedule: Schedule[];
  overrides: Override[];
}) {
  const override = overrides.find((o) => o.date === date);

  if (override?.is_closed) {
    return [];
  }

  let start: string | null = null;
  let end: string | null = null;

  if (override && override.work_start && override.work_end) {
    start = override.work_start;
    end = override.work_end;
  } else {
    const day = getDayOfWeek(date);

    const daySchedule = schedule.find(
      (s) => s.day_of_week === day
    );

    if (!daySchedule || !daySchedule.is_working) {
      return [];
    }

    start = daySchedule.work_start;
    end = daySchedule.work_end;
  }

  // 🔴 PROTECȚIE
  if (!start || !end) return [];

  const slots = generateSlots({
    start,
    end,
    step: 15,
  });

  return slots.filter((time) => {
    const full = toISO(date, time);

    return isSlotFree({
      slot: full,
      duration,
      bookings,
    });
  });
}
import { generateSlots } from "./generateSlots";
import { isSlotFree } from "./isSlotFree";
import { getDayOfWeek } from "./time-utils";
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

  // 🔥 override are prioritate
  if (override && override.work_start && override.work_end) {
    start = override.work_start;
    end = override.work_end;
  } else {
    const day = getDayOfWeek(date);

    const daySchedule = schedule.find(
      (s) => Number(s.day_of_week) === Number(day)
    );

    if (daySchedule && daySchedule.is_working) {
      start = daySchedule.work_start;
      end = daySchedule.work_end;
    }
  }

  // 🔥 FALLBACK (CRITIC)
  if (!start || !end) {
    start = "09:00";
    end = "18:00";
  }

  const slots = generateSlots({
    start,
    end,
    step: 15,
  });

  const validSlots = slots.filter((time) => {
    const startDate = new Date(`${date}T${time}`);
    const endDate = new Date(startDate.getTime() + duration * 60000);

    const workEnd = new Date(`${date}T${end}`);

    return endDate <= workEnd;
  });

  return validSlots.filter((time) => {
    const full = new Date(`${date}T${time}`).toISOString();

    return isSlotFree({
      slot: full,
      duration,
      bookings,
    });
  });
}
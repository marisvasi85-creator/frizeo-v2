import { Booking, Slot, BarberSettings } from "./types";
import { buildWorkIntervals } from "./buildWorkIntervals";
import { subtractBreak } from "./subtractBreak";
import { generateSlots } from "./generateSlots";
import { filterBookedSlots } from "./filterBookedSlots";

/**
 * weekly  = rând din barber_weekly_schedule
 * override = rând din barber_overrides (sau null)
 */
export function getAvailableSlots(params: {
  date: string;
  weekly: {
    is_working: boolean;
    work_start: string | null;
    work_end: string | null;
    break_enabled: boolean;
    break_start: string | null;
    break_end: string | null;
  };
  override?: {
    is_closed?: boolean;
    work_start?: string | null;
    work_end?: string | null;
    break_enabled?: boolean;
    break_start?: string | null;
    break_end?: string | null;
    slot_duration?: number | null;
  } | null;
  settings: BarberSettings;
  bookings: Booking[];
}): Slot[] {
  const { date, weekly, override, settings, bookings } = params;

  console.log("🧮 getAvailableSlots()");
  console.log("weekly:", weekly);
  console.log("override:", override);
  console.log("settings:", settings);
  console.log("bookings:", bookings);

  /* =========================
     GUARDS
  ========================= */
  if (!weekly || weekly.is_working !== true) {
    console.log("⛔ weekly not working");
    return [];
  }

  if (override?.is_closed === true) {
    console.log("⛔ override closed");
    return [];
  }

  /* =========================
     WORK INTERVAL
  ========================= */
  const work_start =
    override?.work_start ??
    weekly.work_start;

  const work_end =
    override?.work_end ??
    weekly.work_end;

  if (!work_start || !work_end) {
    console.log("⛔ missing work_start / work_end");
    return [];
  }

  /* =========================
     BREAK
  ========================= */
  const break_enabled =
    override?.break_enabled ??
    weekly.break_enabled;

  const break_start =
    break_enabled
      ? override?.break_start ?? weekly.break_start
      : null;

  const break_end =
    break_enabled
      ? override?.break_end ?? weekly.break_end
      : null;

  /* =========================
     SLOT DURATION
  ========================= */
  const slotDuration =
    override?.slot_duration ??
    settings.slot_duration;

  if (!slotDuration || slotDuration <= 0) {
    console.log("⛔ invalid slot_duration");
    return [];
  }

  /* =========================
     BUILD INTERVALS
  ========================= */
  let intervals = buildWorkIntervals(
    date,
    work_start,
    work_end
  );

  console.log("🕒 intervals before break:", intervals);

  intervals = subtractBreak(
    intervals,
    date,
    break_start,
    break_end
  );

  console.log("☕ intervals after break:", intervals);

  /* =========================
     GENERATE SLOTS
  ========================= */
  const slots = generateSlots(intervals, slotDuration);

  console.log("🧩 slots generated:", slots);

  /* =========================
     FILTER BOOKINGS
  ========================= */
  const available = filterBookedSlots(
    date,
    slots,
    bookings
  );

  console.log("✅ slots available:", available);

  return available;
}

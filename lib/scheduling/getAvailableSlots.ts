import { Booking, Slot, BarberSettings } from "./types";
import { buildWorkIntervals } from "./buildWorkIntervals";
import { subtractBreak } from "./subtractBreak";
import { generateSlots } from "./generateSlots";
import { filterBookedSlots } from "./filterBookedSlots";

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
  serviceDuration: number;
}): Slot[] {
  const { date, weekly, override, bookings, serviceDuration } = params;

  if (!weekly || weekly.is_working !== true) return [];
  if (override?.is_closed === true) return [];

  const work_start = override?.work_start ?? weekly.work_start;
  const work_end = override?.work_end ?? weekly.work_end;

  if (!work_start || !work_end) return [];

  const break_enabled =
    override?.break_enabled ?? weekly.break_enabled;

  const break_start = break_enabled
    ? override?.break_start ?? weekly.break_start
    : null;

  const break_end = break_enabled
    ? override?.break_end ?? weekly.break_end
    : null;

  const slotDuration =
    override?.slot_duration ?? serviceDuration;

  if (!slotDuration || slotDuration <= 0) return [];

  let intervals = buildWorkIntervals(date, work_start, work_end);
console.log("INTERVALS AFTER BUILD:", intervals);

intervals = subtractBreak(
  intervals,
  date,
  break_start,
  break_end
);
console.log("INTERVALS AFTER BREAK:", intervals);

const generated = generateSlots(intervals, slotDuration);
console.log("GENERATED:", generated);

const filtered = filterBookedSlots(
  date,
  generated,
  bookings
);
console.log("FILTERED:", filtered);
  /* 🔥 Eliminăm sloturile din trecut (LOCAL TIME SAFE) */
const now = new Date();
const todayStr = now.toLocaleDateString("sv-SE"); 
// format YYYY-MM-DD în local time

if (date !== todayStr) return filtered;

return filtered.filter((slot) => {
  const slotDateTime = new Date(`${date}T${slot.start}`);
  return slotDateTime > now;
});
}
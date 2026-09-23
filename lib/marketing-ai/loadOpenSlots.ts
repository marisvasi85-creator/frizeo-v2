import { getBarberMinNoticeHours } from "@/lib/bookings/bookingLeadTime";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { getGoogleBusyIntervalsByDateStrict } from "@/lib/google/getGoogleBusyIntervals";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { DayOverrideRow, WeeklyScheduleRow } from "@/lib/schedule/resolveDaySchedule";
import { normalizeScheduleMode } from "@/lib/schedule/resolveDaySchedule";
import {
  scheduleDayForDate,
  summarizeOpenDays,
  type OpenSlotBooking,
  type OpenSlotDaySource,
} from "./openSlots";
import type { OpenSlotDayFact } from "./types";

const HORIZON_DAYS = 7;

export type OpenSlotLoadResult =
  | { ok: true; days: OpenSlotDayFact[] }
  | { ok: false };

export async function loadOpenSlotSummary(input: {
  barberId: string;
  durationMinutes: number | null;
  now?: Date;
}): Promise<OpenSlotLoadResult> {
  const now = input.now ?? new Date();
  const start = getTodayInBookingTimezone(now);
  const end = addDaysToDateString(start, HORIZON_DAYS - 1);

  const [barberRes, scheduleRes, overrideRes, bookingRes, noticeHours, google] =
    await Promise.all([
      supabaseAdmin
        .from("barbers")
        .select("schedule_mode")
        .eq("id", input.barberId)
        .maybeSingle(),
      supabaseAdmin
        .from("barber_weekly_schedule")
        .select("*")
        .eq("barber_id", input.barberId),
      supabaseAdmin
        .from("barber_day_overrides")
        .select("*")
        .eq("barber_id", input.barberId)
        .gte("date", start)
        .lte("date", end),
      supabaseAdmin
        .from("bookings")
        .select("id, date, start_time, end_time, status, expires_at")
        .eq("barber_id", input.barberId)
        .gte("date", start)
        .lte("date", end)
        .in("status", ["confirmed", "pending"]),
      getBarberMinNoticeHours(supabaseAdmin, input.barberId),
      getGoogleBusyIntervalsByDateStrict(supabaseAdmin, input.barberId, start, end),
    ]);

  if (barberRes.error || scheduleRes.error || overrideRes.error || bookingRes.error) {
    console.error("OPEN SLOTS LOAD ERROR", {
      barber: barberRes.error?.message,
      schedule: scheduleRes.error?.message,
      override: overrideRes.error?.message,
      booking: bookingRes.error?.message,
    });
    return { ok: false };
  }

  if (!google.ok) return { ok: false };

  const scheduleMode = normalizeScheduleMode(
    (barberRes.data as { schedule_mode?: string | null } | null)?.schedule_mode,
  );
  const weeklyRows = (scheduleRes.data || []) as WeeklyScheduleRow[];
  const overrides = (overrideRes.data || []) as DayOverrideRow[];
  const bookings = (bookingRes.data || []) as Array<
    OpenSlotBooking & { date: string }
  >;

  const days: OpenSlotDaySource[] = [];
  for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
    const date = addDaysToDateString(start, offset);
    const scheduleDay = scheduleDayForDate(date);
    days.push({
      date,
      scheduleMode,
      weekly:
        weeklyRows.find((row) => row.day_of_week === scheduleDay) ?? null,
      override: overrides.find((row) => String(row.date).slice(0, 10) === date) ?? null,
      bookings: bookings
        .filter((row) => String(row.date).slice(0, 10) === date)
        .map((row) => ({
          id: row.id,
          start_time: row.start_time,
          end_time: row.end_time,
          status: row.status,
          expires_at: row.expires_at,
        })),
      googleBusy: google.byDate[date] ?? [],
      durationMinutes: input.durationMinutes,
      minNoticeHours: noticeHours,
      now,
    });
  }

  return { ok: true, days: summarizeOpenDays(days) };
}

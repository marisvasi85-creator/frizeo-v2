import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { allowBarberScheduling } from "@/lib/barbers/requireActiveBarberForBooking";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import { addDays, format } from "date-fns";
import {
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { jsDayToScheduleDay } from "@/lib/schedule/time";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!barberId || !from || !to) {
      return NextResponse.json({
        availableDays: [],
        weeklySchedule: [],
        overrides: [],
      });
    }

    const excludeBookingId = searchParams.get("excludeBookingId");
    const barberCheck = await allowBarberScheduling(barberId, {
      excludeBookingId,
    });

    if (!barberCheck.ok) {
      return NextResponse.json({
        availableDays: [],
        weeklySchedule: [],
        overrides: [],
        error: barberCheck.error,
      });
    }

    const { data: weekly } = await supabaseAdmin
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", barberId);

    const { data: overrides } = await supabaseAdmin
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", barberId);

    const availableDays: string[] = [];

    let current = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");

    while (current <= end) {
      const dateStr = format(current, "yyyy-MM-dd");
      const todayStr = getTodayInBookingTimezone();

      if (dateStr < todayStr) {
        current = addDays(current, 1);
        continue;
      }

      const day = jsDayToScheduleDay(dateStr);

      const schedule = weekly?.find((w) => w.day_of_week === day);
      const override = overrides?.find((o) => o.date === dateStr);
      const resolved = resolveDaySchedule(schedule, override);

      if (resolved.isWorking) {
        availableDays.push(dateStr);
      }

      current = addDays(current, 1);
    }

    return NextResponse.json({
      availableDays,
      weeklySchedule: weekly ?? [],
      overrides: overrides ?? [],
    });
  } catch (err) {
    console.error("AVAILABILITY ERROR:", err);
    return NextResponse.json({
      availableDays: [],
      weeklySchedule: [],
      overrides: [],
    });
  }
}

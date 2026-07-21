import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { allowBarberScheduling } from "@/lib/barbers/requireActiveBarberForBooking";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import { addDays, format } from "date-fns";
import { getTodayInBookingTimezone } from "@/lib/bookings/bookingTimezone";
import { jsDayToScheduleDay } from "@/lib/schedule/time";
import { generatePublicFreeSlots } from "@/lib/schedule/generatePublicFreeSlots";
import { getBarberMinNoticeHours } from "@/lib/bookings/bookingLeadTime";
import { getGoogleBusyIntervalsByDate } from "@/lib/google/getGoogleBusyIntervals";
import { groupVacationPeriods } from "@/lib/schedule/vacationPeriods";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const serviceId = searchParams.get("serviceId");
    const excludeBookingId = searchParams.get("excludeBookingId");

    if (!barberId || !from || !to) {
      return NextResponse.json({
        availableDays: [],
        weeklySchedule: [],
        overrides: [],
        vacationPeriods: [],
      });
    }

    const barberCheck = await allowBarberScheduling(barberId, {
      excludeBookingId,
    });

    if (!barberCheck.ok) {
      return NextResponse.json({
        availableDays: [],
        weeklySchedule: [],
        overrides: [],
        vacationPeriods: [],
        error: barberCheck.error,
      });
    }

    const [weeklyRes, overridesRes, serviceRes] = await Promise.all([
      supabaseAdmin
        .from("barber_weekly_schedule")
        .select("*")
        .eq("barber_id", barberId),
      supabaseAdmin
        .from("barber_day_overrides")
        .select("*")
        .eq("barber_id", barberId),
      serviceId
        ? supabaseAdmin
            .from("barber_services")
            .select("duration")
            .eq("id", serviceId)
            .maybeSingle()
        : Promise.resolve({ data: null as { duration: number } | null }),
    ]);

    const weekly = weeklyRes.data;
    const overrides = overridesRes.data;
    const duration = serviceRes.data?.duration ?? null;

    if (serviceId && !serviceRes.data) {
      return NextResponse.json({
        availableDays: [],
        weeklySchedule: weekly ?? [],
        overrides: overrides ?? [],
      });
    }

    let bookingsByDate: Record<string, any[]> = {};
    let googleBusyByDate: Record<string, any[]> = {};
    let minNoticeHours = 0;
    const now = new Date();

    if (serviceId && duration) {
      const [bookingsRes, noticeHours, googleBusy] = await Promise.all([
        supabaseAdmin
          .from("bookings")
          .select("id, date, start_time, end_time, status, expires_at")
          .eq("barber_id", barberId)
          .gte("date", from)
          .lte("date", to)
          .in("status", ["confirmed", "pending"]),
        getBarberMinNoticeHours(supabaseAdmin, barberId),
        getGoogleBusyIntervalsByDate(supabaseAdmin, barberId, from, to),
      ]);

      for (const booking of bookingsRes.data ?? []) {
        if (!bookingsByDate[booking.date]) {
          bookingsByDate[booking.date] = [];
        }
        bookingsByDate[booking.date].push(booking);
      }

      minNoticeHours = noticeHours;
      googleBusyByDate = googleBusy;
    }

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

      if (!resolved.isWorking) {
        current = addDays(current, 1);
        continue;
      }

      if (serviceId && duration) {
        const freeSlots = generatePublicFreeSlots({
          date: dateStr,
          resolved,
          duration,
          bookings: bookingsByDate[dateStr] ?? [],
          googleBusyIntervals: googleBusyByDate[dateStr] ?? [],
          minNoticeHours,
          now,
          excludeBookingId,
        });

        if (freeSlots.length > 0) {
          availableDays.push(dateStr);
        }
      } else {
        availableDays.push(dateStr);
      }

      current = addDays(current, 1);
    }

    const vacationPeriods = groupVacationPeriods(
      (overrides ?? []).filter(
        (o) => o.is_closed && o.date >= from && o.date <= to,
      ),
    );

    return NextResponse.json({
      availableDays,
      weeklySchedule: weekly ?? [],
      overrides: overrides ?? [],
      vacationPeriods,
    });
  } catch (err) {
    console.error("AVAILABILITY ERROR:", err);
    return NextResponse.json({
      availableDays: [],
      weeklySchedule: [],
      overrides: [],
      vacationPeriods: [],
    });
  }
}

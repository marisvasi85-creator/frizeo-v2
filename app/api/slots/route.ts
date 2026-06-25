import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveBookings } from "@/lib/schedule/bookings";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import {
  jsDayToScheduleDay,
  minutesToTime,
  timeToMinutes,
} from "@/lib/schedule/time";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");
  const mode = searchParams.get("mode");
  const excludeBookingId = searchParams.get("excludeBookingId");

  if (!barberId || !date) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = supabaseAdmin;

  const { data: override } = await supabase
    .from("barber_day_overrides")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date)
    .maybeSingle();

  const day = jsDayToScheduleDay(date);

  const { data: schedule } = await supabase
    .from("barber_weekly_schedule")
    .select("*")
    .eq("barber_id", barberId)
    .eq("day_of_week", day)
    .maybeSingle();

  let effectiveOverride = override;

  if (mode === "admin" && excludeBookingId && override?.is_closed) {
    const { data: excludedBooking } = await supabase
      .from("bookings")
      .select("date")
      .eq("id", excludeBookingId)
      .maybeSingle();

    if (excludedBooking?.date === date) {
      effectiveOverride = null;
    }
  }

  const resolved = resolveDaySchedule(schedule, effectiveOverride);

  if (!resolved.isWorking || !resolved.workStart || !resolved.workEnd) {
    return NextResponse.json({ slots: [] });
  }

  const start = timeToMinutes(resolved.workStart);
  const end = timeToMinutes(resolved.workEnd);

  const breakStart =
    resolved.breakEnabled && resolved.breakStart
      ? timeToMinutes(resolved.breakStart)
      : null;

  const breakEnd =
    resolved.breakEnabled && resolved.breakEnd
      ? timeToMinutes(resolved.breakEnd)
      : null;

  let duration = resolved.slotDuration ?? 15;

  if (serviceId) {
    const { data: service } = await supabase
      .from("barber_services")
      .select("duration")
      .eq("id", serviceId)
      .single();

    if (service) duration = service.duration;
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date)
    .in("status", ["confirmed", "pending"]);

  const activeBookings = getActiveBookings(bookings).filter(
    (b) => b.id !== excludeBookingId
  );

  function generateSlots(startMin: number, endMin: number) {
    const arr: any[] = [];
    const step = mode === "admin" ? 15 : duration;

    for (let t = startMin; t + duration <= endMin; t += step) {
      const slotStart = t;
      const slotEnd = t + duration;

      const booking = activeBookings.find((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        return slotStart < bEnd && slotEnd > bStart;
      });

      if (mode === "admin") {
        if (booking) {
          const isStart =
            timeToMinutes(booking.start_time) === slotStart;

          if (isStart) {
            arr.push({
              type: "booking",
              time: booking.start_time.slice(0, 5),
              end: booking.end_time.slice(0, 5),
              booking,
            });
          }
          continue;
        }

        if (breakStart !== null && breakEnd !== null) {
          const overlapsBreak =
            slotStart < breakEnd && slotEnd > breakStart;
          if (overlapsBreak) continue;
        }

        arr.push({
          type: "free",
          time: minutesToTime(t),
        });

        continue;
      }

      if (booking) continue;

      if (breakStart !== null && breakEnd !== null) {
        const overlapsBreak = slotStart < breakEnd && slotEnd > breakStart;
        if (overlapsBreak) continue;
      }

      arr.push({
        type: "free",
        time: minutesToTime(t),
      });
    }

    return arr;
  }

  let finalSlots: any[] = [];

  if (breakStart === null || breakEnd === null) {
    finalSlots = generateSlots(start, end);
  } else if (mode === "admin") {
    finalSlots = [
      ...generateSlots(start, breakStart),
      {
        type: "break",
        start: minutesToTime(breakStart),
        end: minutesToTime(breakEnd),
      },
      ...generateSlots(breakEnd, end),
    ];
  } else {
    finalSlots = [
      ...generateSlots(start, breakStart),
      ...generateSlots(breakEnd, end),
    ];
  }

  return NextResponse.json({ slots: finalSlots });
}

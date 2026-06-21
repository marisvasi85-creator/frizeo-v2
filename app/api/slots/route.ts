import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveBookings } from "@/lib/schedule/bookings";
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

  if (!barberId || !date) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = await createSupabaseServerClient();
  const { data: override } = await supabase
    .from("barber_day_overrides")
    .select("is_closed")
    .eq("barber_id", barberId)
    .eq("date", date)
    .maybeSingle();

  if (override?.is_closed) {
    return NextResponse.json({ slots: [] });
  }

  const day = jsDayToScheduleDay(date);

  const { data: schedule } = await supabase
    .from("barber_weekly_schedule")
    .select("*")
    .eq("barber_id", barberId)
    .eq("day_of_week", day)
    .single();

  if (!schedule || !schedule.is_working) {
    return NextResponse.json({ slots: [] });
  }

  const start = timeToMinutes(schedule.work_start);
  const end = timeToMinutes(schedule.work_end);

  const breakStart =
    schedule.break_enabled && schedule.break_start
      ? timeToMinutes(schedule.break_start)
      : null;

  const breakEnd =
    schedule.break_enabled && schedule.break_end
      ? timeToMinutes(schedule.break_end)
      : null;

  let duration = 15;

  if (mode !== "admin" && serviceId) {
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

  const activeBookings = getActiveBookings(bookings);

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
        const isStart =
          booking && timeToMinutes(booking.start_time) === slotStart;

        if (isStart) {
          arr.push({
            type: "booking",
            time: booking.start_time.slice(0, 5),
            end: booking.end_time.slice(0, 5),
            booking,
          });
          continue;
        }

        arr.push({
          type: "free",
          time: minutesToTime(t),
        });

        continue;
      }

      if (booking) continue;

      if (breakStart && breakEnd) {
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

  if (!breakStart || !breakEnd) {
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

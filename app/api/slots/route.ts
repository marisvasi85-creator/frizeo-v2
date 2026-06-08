import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function timeToMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

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

  // DATE
  const [y, m, d] = date.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  const jsDay = local.getDay();
  const day = jsDay === 0 ? 7 : jsDay;

  // SCHEDULE
  const { data: schedules } = await supabase
    .from("barber_weekly_schedule")
    .select("*");

  const schedule = schedules?.find(
    (s) => s.barber_id === barberId && s.day_of_week === day
  );

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

  // 🔥 DURATA
  let duration = 15;

  if (mode !== "admin" && serviceId) {
    const { data: service } = await supabase
      .from("barber_services")
      .select("duration")
      .eq("id", serviceId)
      .single();

    if (service) duration = service.duration;
  }

  // BOOKINGS
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date)
    .in("status", ["confirmed", "pending"]);

  function generateSlots(startMin: number, endMin: number) {
  const arr: any[] = [];

  // 🔥 ADMIN vs PUBLIC
  const step = mode === "admin" ? 15 : duration;

  for (let t = startMin; t + duration <= endMin; t += step) {
    const slotStart = t;
    const slotEnd = t + duration;

    // 🔴 verific booking
    const booking = bookings?.find((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return slotStart < bEnd && slotEnd > bStart;
    });

    if (booking) {
      const isStart =
        timeToMinutes(booking.start_time) === slotStart;

      // 🔵 ADMIN → arată doar începutul
      if (mode === "admin" && isStart) {
        arr.push({
  type: "booking",
  time: booking.start_time.slice(0, 5),
  end: booking.end_time.slice(0, 5), // 🔥 FIX
  booking,
});
      }

      // 🟢 PUBLIC → dispare complet
      continue;
    }

    // 🟡 PUBLIC → blocăm dacă NU încape (pauză)
    if (mode !== "admin" && breakStart && breakEnd) {
      const overlapsBreak =
        slotStart < breakEnd && slotEnd > breakStart;

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
  } else {
    if (mode === "admin") {
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
  }

  return NextResponse.json({ slots: finalSlots });
}
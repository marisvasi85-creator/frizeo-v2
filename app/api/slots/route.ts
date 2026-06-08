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
  const mode = searchParams.get("mode"); // admin / null

  if (!barberId || !date) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = await createSupabaseServerClient();

  // =========================
  // DATE
  // =========================
  const [y, m, d] = date.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  const jsDay = local.getDay();
  const day = jsDay === 0 ? 7 : jsDay;

  // =========================
  // SCHEDULE
  // =========================
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

  // =========================
  // SERVICE DURATION
  // =========================
  let duration = 30;

  if (serviceId && serviceId !== "preview") {
    const { data: service } = await supabase
      .from("barber_services")
      .select("duration")
      .eq("id", serviceId)
      .single();

    if (!service) return NextResponse.json({ slots: [] });

    duration = service.duration;
  }

  // =========================
  // BOOKINGS
  // =========================
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date)
    .in("status", ["confirmed", "pending"]);

  // =========================
  // SLOT GENERATOR (CORE FIX)
  // =========================
  function generateSlots(startMin: number, endMin: number) {
    const arr: any[] = [];

    // 🔥 diferență admin vs public
    const step = mode === "admin" ? 15 : duration;

    for (let t = startMin; t + duration <= endMin; t += step) {
      const slotStart = t;
      const slotEnd = t + duration;

      const booking = bookings?.find((b) => {
        const bStart = timeToMinutes(b.start_time);
        const bEnd = timeToMinutes(b.end_time);
        return slotStart < bEnd && slotEnd > bStart;
      });

      if (booking) {
        const isStart =
          timeToMinutes(booking.start_time) === slotStart;

        if (isStart) {
          arr.push({
            type: "booking",
            time: booking.start_time.slice(0, 5),
            booking,
          });
        } else if (mode === "admin") {
          // 🔥 IMPORTANT: păstrăm sloturile în admin
          arr.push({
            type: "free",
            time: minutesToTime(t),
          });
        }

        continue;
      }

      arr.push({
        type: "free",
        time: minutesToTime(t),
      });
    }

    return arr;
  }

  // =========================
  // FINAL STRUCTURE
  // =========================
  let finalSlots: any[] = [];

  if (!breakStart || !breakEnd) {
    finalSlots = generateSlots(start, end);
  } else {
    if (mode === "admin") {
      // ADMIN → vede pauza
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
      // PUBLIC → elimină pauza complet
      finalSlots = [
        ...generateSlots(start, breakStart),
        ...generateSlots(breakEnd, end),
      ];
    }
  }

  return NextResponse.json({ slots: finalSlots });
}
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

  console.log("🔥 PARAMS:", { barberId, date, serviceId });

  if (!barberId || !date) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = await createSupabaseServerClient();

  // 🔥 ZI FĂRĂ BUG
  const [y, m, d] = date.split("-").map(Number);
  const local = new Date(y, m - 1, d);

  const jsDay = local.getDay();
  const day = jsDay === 0 ? 7 : jsDay;

  console.log("🔥 DAY:", day);

  // 🔥 LUĂM TOATE SCHEDULE-URILE (IMPORTANT)
  const { data: schedules } = await supabase
    .from("barber_weekly_schedule")
    .select("*")
    .eq("day_of_week", day);

  console.log("🔥 ALL SCHEDULES:", schedules);

  // 🔥 FILTRARE MANUALĂ
  const schedule = schedules?.find(
    (s) => s.barber_id === barberId
  );

  console.log("🔥 PICKED SCHEDULE:", schedule);

  if (!schedule || !schedule.is_working) {
    console.log("❌ NOT WORKING DAY");
    return NextResponse.json({ slots: [] });
  }

  let start = timeToMinutes(schedule.work_start);
  let end = timeToMinutes(schedule.work_end);

  console.log("🔥 WORK HOURS:", start, end);

  // 🔥 DURATA
  let duration = 30;

  if (serviceId && serviceId !== "preview") {
    const { data: service } = await supabase
      .from("barber_services")
      .select("duration")
      .eq("id", serviceId)
      .single();

    console.log("🔥 SERVICE:", service);

    if (!service) return NextResponse.json({ slots: [] });

    duration = service.duration;
  }

  // 🔥 BOOKINGS
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date)
    .in("status", ["confirmed", "pending"]);

  console.log("🔥 BOOKINGS:", bookings);

  const slots: any[] = [];

  for (let t = start; t + duration <= end; t += 15) {
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
        slots.push({
          time: booking.start_time.slice(0, 5),
          occupied: true,
          booking,
        });
      }

      continue;
    }

    slots.push({
      time: minutesToTime(t),
      occupied: false,
      booking: null,
    });
  }

  console.log("🔥 FINAL SLOTS:", slots);

  return NextResponse.json({ slots });
}
import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

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

  if (!barberId || !date) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = createSupabasePublicClient();

  const [year, month, dayStr] = date.split("-").map(Number);
  const localDate = new Date(year, month - 1, dayStr);

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

  const { data: settings } = await supabase
    .from("barber_settings")
    .select("break_between_enabled, break_between_minutes")
    .eq("barber_id", barberId)
    .single();

  const effectiveDuration = settings?.break_between_enabled
    ? duration + (settings?.break_between_minutes || 0)
    : duration;

  const jsDay = localDate.getDay();
  const day = jsDay === 0 ? 7 : jsDay;

  const { data: schedule } = await supabase
    .from("barber_weekly_schedule")
    .select("is_working, work_start, work_end")
    .eq("barber_id", barberId)
    .eq("day_of_week", day)
    .maybeSingle();

  if (schedule && !schedule.is_working) {
    return NextResponse.json({ slots: [] });
  }

  let start = timeToMinutes(schedule?.work_start || "09:00");
  let end = timeToMinutes(schedule?.work_end || "18:00");

  const { data: bookings } = await supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("barber_id", barberId)
    .eq("date", date);

  const occupied = (bookings || []).map((b) => ({
    start: timeToMinutes(b.start_time),
    end: timeToMinutes(b.end_time),
  }));

  const slots: string[] = [];

  for (let t = start; t + effectiveDuration <= end; t += 15) {
    const overlap = occupied.some(
      (b) => t < b.end && t + effectiveDuration > b.start
    );

    if (!overlap) {
      slots.push(minutesToTime(t));
    }
  }

  return NextResponse.json({ slots });
}
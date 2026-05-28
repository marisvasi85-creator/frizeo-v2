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
  const excludeBookingId = searchParams.get("excludeBookingId");

  if (!barberId || !date || !serviceId) {
    return NextResponse.json({ slots: [] });
  }

  const supabase = createSupabasePublicClient();
  const normalizedDate = new Date(date).toISOString().split("T")[0];

  // =========================
  // 🔥 SERVICE
  // =========================
  const { data: service } = await supabase
    .from("barber_services")
    .select("duration")
    .eq("id", serviceId)
    .single();

  if (!service) {
    return NextResponse.json({ slots: [] });
  }

  const duration = service.duration;

  // =========================
  // 🔥 SETTINGS (pauză între programări)
  // =========================
  const { data: settings } = await supabase
    .from("barber_settings")
    .select("break_between_enabled, break_between_minutes")
    .eq("barber_id", barberId)
    .single();

  const breakEnabled = settings?.break_between_enabled ?? false;
  const breakMinutes = settings?.break_between_minutes ?? 0;

  const effectiveDuration = breakEnabled
    ? duration + breakMinutes
    : duration;

  // =========================
  // 🔥 BOOKINGS
  // =========================
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, start_time, end_time, status, expires_at")
    .eq("barber_id", barberId)
    .eq("date", normalizedDate);

  const now = new Date();

  const activeBookings = (bookings || [])
    .filter((b: any) => {
      if (excludeBookingId && b.id === excludeBookingId) return false;

      if (b.status === "confirmed") return true;
      if (b.status === "pending" && b.expires_at) {
        return new Date(b.expires_at) > now;
      }
      return false;
    })
    .map((b: any) => ({
      start: timeToMinutes(b.start_time),
      end: timeToMinutes(b.end_time),
    }))
    .sort((a: any, b: any) => a.start - b.start);

  // =========================
  // 🔥 PROGRAM (fix momentan)
  // =========================
  const WORK_START = timeToMinutes("09:00");
  const WORK_END = timeToMinutes("18:00");

  let freeIntervals: { start: number; end: number }[] = [];
  let cursor = WORK_START;

  for (const b of activeBookings) {
    if (b.start > cursor) {
      freeIntervals.push({ start: cursor, end: b.start });
    }
    cursor = Math.max(cursor, b.end);
  }

  if (cursor < WORK_END) {
    freeIntervals.push({ start: cursor, end: WORK_END });
  }

  // =========================
  // 🔥 PAUZĂ MASĂ
  // =========================
  const day = new Date(date).getDay() || 7;

  const { data: schedule } = await supabase
    .from("barber_weekly_schedule")
    .select("break_enabled, break_start, break_end")
    .eq("barber_id", barberId)
    .eq("day_of_week", day)
    .single();

  if (schedule?.break_enabled && schedule.break_start && schedule.break_end) {
    const breakStart = timeToMinutes(schedule.break_start);
    const breakEnd = timeToMinutes(schedule.break_end);

    freeIntervals = freeIntervals.flatMap((interval) => {
      if (interval.end <= breakStart || interval.start >= breakEnd) {
        return [interval];
      }

      let parts = [];

      if (interval.start < breakStart) {
        parts.push({ start: interval.start, end: breakStart });
      }

      if (interval.end > breakEnd) {
        parts.push({ start: breakEnd, end: interval.end });
      }

      return parts;
    });
  }

  // =========================
  // 🔥 GENERARE SLOTURI
  // =========================
  let slots: string[] = [];

  for (const interval of freeIntervals) {
    let cursor = interval.start;

    while (cursor + effectiveDuration <= interval.end) {
      slots.push(minutesToTime(cursor));
      cursor += 15;
    }
  }

  slots.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

  return NextResponse.json({ slots });
}
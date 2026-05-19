import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
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

  if (!barberId || !date || !serviceId) {
    return NextResponse.json([]);
  }

  const supabase = createSupabasePublicClient();
  const normalizedDate = new Date(date).toISOString().split("T")[0];

  // 🔥 SERVICE
  const { data: service } = await supabase
    .from("barber_services")
    .select("duration")
    .eq("id", serviceId)
    .single();

  const duration = service?.duration || 30;

  // 🔥 BOOKINGS
  const { data: bookings } = await supabase
    .from("bookings")
    .select("start_time, end_time, status, expires_at")
    .eq("barber_id", barberId)
    .eq("date", normalizedDate);

  const now = new Date();

  const activeBookings = (bookings || [])
    .filter((b: any) => {
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

  const WORK_START = timeToMinutes("09:00");
  const WORK_END = timeToMinutes("18:00");

  // 🔥 1. INTERVALE LIBERE
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

  // 🔥 2. GENERARE SLOTURI HYBRID (BEST)

let slotsSet = new Set<string>();

for (const interval of freeIntervals) {
  let start = interval.start;

  // 🔹 1. SLOTURI FLEXIBILE (din 15 în 15)
  let cursorFlex = start;

  while (cursorFlex + duration <= interval.end) {
    slotsSet.add(minutesToTime(cursorFlex));
    cursorFlex += 15;
  }

  // 🔹 2. SLOTURI PERFECT ALIGN (durata serviciului)
  let cursorPerfect = start;

  while (cursorPerfect + duration <= interval.end) {
    slotsSet.add(minutesToTime(cursorPerfect));
    cursorPerfect += duration;
  }
}

// 🔥 3. SORTARE FINALĂ
const slots = Array.from(slotsSet).sort(
  (a, b) => timeToMinutes(a) - timeToMinutes(b)
);

return NextResponse.json(slots);

  return NextResponse.json(slots);
}
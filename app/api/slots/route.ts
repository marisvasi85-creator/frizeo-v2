import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(0, 0, 0, h, m + minutes);
  return d.toTimeString().slice(0, 5);
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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

  // 🔥 duration
  const { data: service } = await supabase
    .from("barber_services")
    .select("duration")
    .eq("id", serviceId)
    .single();

  const duration = service?.duration || 30;

  // 🔥 bookings
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
    .sort((a: any, b: any) =>
      timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
    );

  const start = "09:00";
  const end = "18:00";

  let slots: string[] = [];

  let current = start;

  while (current < end) {
    const slotEnd = addMinutes(current, duration);

    if (slotEnd > end) break;

    const overlaps = activeBookings.some((b: any) => {
      return current < b.end_time && slotEnd > b.start_time;
    });

    if (!overlaps) {
      slots.push(current);
    }

    current = addMinutes(current, 15);
  }

  // 🔥 🔥 🔥 EASYWEEK LOGIC (ANTI GAPS)

  const smartSlots = slots.filter((slot) => {
    const slotStart = timeToMinutes(slot);
    const slotEnd = slotStart + duration;

    // caută dacă slotul lasă un gap mic inutil
    for (const b of activeBookings) {
      const bStart = timeToMinutes(b.start_time);

      const gap = bStart - slotEnd;

      // 🔥 dacă lasă gap < 15 min → nu e ok
      if (gap > 0 && gap < 15) {
        return false;
      }
    }

    return true;
  });

  return NextResponse.json(smartSlots);
}
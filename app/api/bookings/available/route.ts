import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Booking = {
  booking_time: string;
};

type Override = {
  is_closed: boolean;
  start_time: string | null;
  end_time: string | null;
};

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const toTime = (m: number) => {
  const h = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${h}:${mm}`;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  if (!barberId || !date) {
    return NextResponse.json({ slots: [] });
  }

  // 🔑 AICI ERA PROBLEMA
  const supabase = await createClient();

  /* SETTINGS */
  const { data: settings } = await supabase
    .from("barber_settings")
    .select("*")
    .eq("barber_id", barberId)
    .single();

  if (!settings) {
    return NextResponse.json({ slots: [] });
  }

  /* BOOKINGS */
  const { data: bookings } = await supabase
    .from("bookings")
    .select("booking_time")
    .eq("barber_id", barberId)
    .eq("date", date);

  const busy = new Set(
    (bookings || []).map((b: Booking) => b.booking_time)
  );

  /* OVERRIDES */
  const { data: overrides } = await supabase
    .from("barber_overrides")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date);

  if (overrides?.some((o: Override) => o.is_closed)) {
    return NextResponse.json({ slots: [] });
  }

  /* GENERARE SLOTURI */
  const slots: string[] = [];

  const start = toMinutes(settings.start_time);
  const end = toMinutes(settings.end_time);
  const duration = settings.slot_duration;

  for (let m = start; m + duration <= end; m += duration) {
    const time = toTime(m);

    if (
      settings.break_enabled &&
      m >= toMinutes(settings.break_start) &&
      m < toMinutes(settings.break_end)
    ) {
      continue;
    }

    if (busy.has(time)) continue;

    const blocked = overrides?.some((o: Override) => {
      if (!o.start_time || !o.end_time) return false;
      return (
        m >= toMinutes(o.start_time) &&
        m < toMinutes(o.end_time)
      );
    });

    if (!blocked) {
      slots.push(time);
    }
  }

  return NextResponse.json({ slots });
}

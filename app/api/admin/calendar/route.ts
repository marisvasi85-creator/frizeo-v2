import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
/* ================== HELPERS ================== */
function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/* ================== GET ================== */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  if (!barberId || !date) {
    return NextResponse.json({ slots: [] });
  }


  /* ================== 1️⃣ OVERRIDE ================== */
  const { data: override } = await supabase
    .from("barber_day_overrides")
    .select("*")
    .eq("barber_id", barberId)
    .eq("date", date)
    .maybeSingle();

  if (override?.is_closed) {
    return NextResponse.json({ slots: [] });
  }

  /* ================== 2️⃣ SETTINGS ================== */
  const { data: settings } = await supabase
    .from("barber_settings")
    .select("*")
    .eq("barber_id", barberId)
    .single();

  if (!settings) {
    return NextResponse.json({ slots: [] });
  }

  /* ================== PROGRAM (override > settings) ================== */
  const startTime = override?.start_time ?? settings.start_time;
  const endTime = override?.end_time ?? settings.end_time;
  const slotDuration = settings.slot_duration;

  const breakEnabled =
    override?.break_enabled ?? settings.break_enabled ?? false;

  const breakStart = override?.break_start ?? settings.break_start;
  const breakEnd = override?.break_end ?? settings.break_end;

  /* ================== 3️⃣ BOOKINGS ================== */
  const { data: bookings } = await supabase
    .from("bookings")
    .select("booking_time, client_name, client_phone, service_id")
    .eq("barber_id", barberId)
    .eq("booking_date", date)
    .eq("status", "confirmed");

  const bookingsMap = new Map<
    string,
    { client_name: string; client_phone: string; service_id: string | null }
  >();

  (bookings || []).forEach(
    (b: {
      booking_time: string;
      client_name: string;
      client_phone: string;
      service_id: string | null;
    }) => {
      bookingsMap.set(b.booking_time.slice(0, 5), {
        client_name: b.client_name,
        client_phone: b.client_phone,
        service_id: b.service_id,
      });
    }
  );

  /* ================== 4️⃣ SLOT GENERATION ================== */
  const slots: {
    time: string;
    status: "free" | "booked";
    booking?: {
      client_name: string;
      client_phone: string;
      service_id: string | null;
    };
  }[] = [];

  let current = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  const breakStartMin =
    breakEnabled && breakStart ? timeToMinutes(breakStart) : null;
  const breakEndMin =
    breakEnabled && breakEnd ? timeToMinutes(breakEnd) : null;

  while (current + slotDuration <= end) {
    const slotTime = minutesToTime(current);

    // pauză
    if (
      breakEnabled &&
      breakStartMin !== null &&
      breakEndMin !== null &&
      current >= breakStartMin &&
      current < breakEndMin
    ) {
      current += slotDuration;
      continue;
    }

    // booking existent
    if (bookingsMap.has(slotTime)) {
      slots.push({
        time: slotTime,
        status: "booked",
        booking: bookingsMap.get(slotTime),
      });
    } else {
      slots.push({
        time: slotTime,
        status: "free",
      });
    }

    current += slotDuration;
  }

  return NextResponse.json({ slots });
}

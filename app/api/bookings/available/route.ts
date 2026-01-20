import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");
  const date = searchParams.get("date");

  if (!barberId || !date) {
    return NextResponse.json({ error: "Parametri lipsă" }, { status: 400 });
  }

  const supabase = supabaseServer();
  /* =========================
     1️⃣ Setări frizer
  ========================= */
  const { data: settings } = await supabase
    .from("barber_settings")
    .select(`
      slot_duration,
      start_time,
      end_time,
      break_enabled,
      break_start,
      break_end,
      barbers (
        tenant_id
      )
    `)
    .eq("barber_id", barberId)
    .single();

  if (!settings) {
    return NextResponse.json({ error: "Setări frizer lipsă" }, { status: 404 });
  }

  const tenantId = settings.barbers?.[0]?.tenant_id;

  if (!tenantId) {
    return NextResponse.json({ error: "Tenant lipsă" }, { status: 400 });
  }

  /* =========================
     2️⃣ Sloturi deja rezervate
  ========================= */
  const { data: bookings } = await supabase
    .from("bookings")
    .select("booking_time")
    .eq("barber_id", barberId)
    .eq("tenant_id", tenantId)
    .eq("booking_date", date)
    .eq("status", "confirmed");

  const bookedSlots = bookings?.map(b => b.booking_time) || [];

  /* =========================
     3️⃣ Generăm sloturile
  ========================= */
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const toTime = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  const start = toMinutes(settings.start_time);
  const end = toMinutes(settings.end_time);
  const duration = settings.slot_duration;

  const breakStart = settings.break_enabled
    ? toMinutes(settings.break_start)
    : null;

  const breakEnd = settings.break_enabled
    ? toMinutes(settings.break_end)
    : null;

  const slots: string[] = [];

  for (let m = start; m + duration <= end; m += duration) {
    // ❌ eliminăm pauza
    if (
      settings.break_enabled &&
      breakStart !== null &&
      breakEnd !== null &&
      m >= breakStart &&
      m < breakEnd
    ) {
      continue;
    }

    const time = toTime(m);

    // ❌ eliminăm sloturile rezervate
    if (bookedSlots.includes(time)) {
      continue;
    }

    slots.push(time);
  }

  return NextResponse.json(slots);
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient(); // 🔴 AICI era problema

  const body = await req.json();

  const { barber_id, date, time } = body;

  /* ================= VALIDARE DE BAZĂ ================= */
  if (!barber_id || !date || !time) {
    return NextResponse.json(
      { error: "Date lipsă" },
      { status: 400 }
    );
  }

  /* ================= NU PERMITEM ÎN TRECUT ================= */
  const now = new Date();
  const bookingDateTime = new Date(`${date}T${time}:00`);

  if (bookingDateTime <= now) {
    return NextResponse.json(
      { error: "Nu poți face programări în trecut" },
      { status: 400 }
    );
  }

  /* ================= PROGRAM FRIZER ================= */
  const { data: settings } = await supabase
  .from("barber_settings")
  .select("*")
  .eq("barber_id", barber_id)
  .single();


  if (!settings) {
    return NextResponse.json(
      { error: "Setări frizer inexistente" },
      { status: 400 }
    );
  }

  if (!settings.working_days.includes(new Date(date).getDay())) {
    return NextResponse.json(
      { error: "Zi nelucrătoare" },
      { status: 409 }
    );
  }

  /* ================= BREAK ================= */
  if (
    settings.break_enabled &&
    time >= settings.break_start &&
    time < settings.break_end
  ) {
    return NextResponse.json(
      { error: "Slot în pauză" },
      { status: 409 }
    );
  }

  /* ================= OVERRIDES ================= */
  const { data: overrides } = await supabase
    .from("barber_overrides")
    .select("*")
    .eq("barber_id", barber_id)
    .eq("date", date);

  if (overrides?.length) {
    for (const o of overrides) {
      if (o.is_closed) {
        return NextResponse.json(
          { error: "Ziua este blocată" },
          { status: 409 }
        );
      }

      if (
        o.start_time &&
        o.end_time &&
        time >= o.start_time &&
        time < o.end_time
      ) {
        return NextResponse.json(
          { error: "Slot blocat prin override" },
          { status: 409 }
        );
      }
    }
  }

  /* ================= DUBLU BOOKING ================= */
  const { data: conflict } = await supabase
    .from("bookings")
    .select("id")
    .eq("barber_id", barber_id)
    .eq("date", date)
    .eq("time", time)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json(
      { error: "Slot deja ocupat" },
      { status: 409 }
    );
  }

  /* ================= CREATE ================= */
  const { error } = await supabase.from("bookings").insert({
    barber_id,
    date,
    time,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

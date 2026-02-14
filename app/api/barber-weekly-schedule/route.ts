import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/* =========================
   GET WEEKLY SCHEDULE
========================= */
export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  const { searchParams } = new URL(req.url);
  const barberId = searchParams.get("barberId");

  if (!barberId) {
    return NextResponse.json(
      { error: "Missing barberId" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("barber_weekly_schedule")
    .select("*")
    .eq("barber_id", barberId)
    .order("day_of_week", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(data ?? []);
}

/* =========================
   SAVE WEEKLY SCHEDULE
========================= */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();

  const body = await req.json();
  const { barber_id, days } = body;

  if (!barber_id || !Array.isArray(days)) {
    return NextResponse.json(
      { error: "Invalid payload" },
      { status: 400 }
    );
  }

  const rows = days.map((d: any) => ({
    barber_id,
    day_of_week: d.day_of_week,
    is_working: d.is_working,
    work_start: d.work_start,
    work_end: d.work_end,
    break_enabled: d.break_enabled,
    break_start: d.break_start,
    break_end: d.break_end,
  }));

  const { error } = await supabase
    .from("barber_weekly_schedule")
    .upsert(rows, {
      onConflict: "barber_id,day_of_week",
    });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}

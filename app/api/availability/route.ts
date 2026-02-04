import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const barberId = searchParams.get("barberId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!barberId || !from || !to) {
    return NextResponse.json(
      { error: "Missing params" },
      { status: 400 }
    );
  }

  /* =========================
     WEEKLY SCHEDULE (1 query)
  ========================= */
  const { data: weekly } = await supabase
    .from("barber_weekly_schedule")
    .select("day_of_week, is_working")
    .eq("barber_id", barberId);

  /* =========================
     OVERRIDES (1 query)
  ========================= */
  const { data: overrides } = await supabase
    .from("barber_overrides")
    .select("date, is_closed")
    .eq("barber_id", barberId)
    .gte("date", from)
    .lte("date", to);

  const weeklyMap = new Map(
    weekly?.map((w) => [w.day_of_week, w.is_working])
  );

  const overrideMap = new Map(
    overrides?.map((o) => [o.date, o.is_closed])
  );

  /* =========================
     BUILD AVAILABILITY MAP
  ========================= */
  const availability: Record<string, boolean> = {};

  let current = new Date(from);
  const end = new Date(to);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const jsDay = current.getDay(); // 0–6

    const isWorking = weeklyMap.get(jsDay) === true;
    const isClosed = overrideMap.get(dateStr) === true;

    availability[dateStr] = isWorking && !isClosed;

    current.setDate(current.getDate() + 1);
  }

  return NextResponse.json({ availability });
}

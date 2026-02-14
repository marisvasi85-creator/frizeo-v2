import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
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
       WEEKLY SCHEDULE
    ========================= */
    const { data: weekly, error: weeklyError } = await supabase
      .from("barber_weekly_schedule")
      .select("day_of_week, is_working")
      .eq("barber_id", barberId);

    if (weeklyError) {
      return NextResponse.json(
        { error: "Failed to load weekly schedule" },
        { status: 500 }
      );
    }

    /* =========================
       DAY OVERRIDES
    ========================= */
    const { data: overrides, error: overrideError } = await supabase
      .from("barber_day_overrides")
      .select("date, is_closed")
      .eq("barber_id", barberId)
      .gte("date", from)
      .lte("date", to);

    if (overrideError) {
      return NextResponse.json(
        { error: "Failed to load overrides" },
        { status: 500 }
      );
    }

    const weeklyMap = new Map<number, boolean>(
      weekly?.map((w) => [w.day_of_week, w.is_working])
    );

    const overrideMap = new Map<string, boolean>(
      overrides?.map((o) => [o.date, o.is_closed])
    );

    /* =========================
       BUILD AVAILABILITY MAP
    ========================= */
    const availability: Record<string, boolean> = {};

    let current = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");

    while (current <= end) {
      const dateStr = current.toISOString().slice(0, 10);

      const jsDay = current.getDay(); // 0–6 (Sun–Sat)
      const dayOfWeek = jsDay === 0 ? 7 : jsDay; // DB: 1–7 (Mon–Sun)

      const isWorking = weeklyMap.get(dayOfWeek) === true;
      const isClosed = overrideMap.get(dateStr) === true;

      availability[dateStr] = isWorking && !isClosed;

      current.setDate(current.getDate() + 1);
    }

    return NextResponse.json({ availability });
  } catch (err) {
    console.error("🔥 AVAILABILITY API ERROR", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const date = searchParams.get("date");

    if (!barberId || !date) {
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
    const { data: override, error: overrideError } = await supabase
      .from("barber_day_overrides")
      .select("is_closed")
      .eq("barber_id", barberId)
      .eq("date", date)
      .maybeSingle();

    if (overrideError) {
      return NextResponse.json(
        { error: "Failed to load overrides" },
        { status: 500 }
      );
    }

    /* =========================
       DAY CHECK
    ========================= */

    const jsDay = new Date(date + "T00:00:00").getDay(); // 0–6
    const dayOfWeek = jsDay === 0 ? 7 : jsDay; // 1–7

    const weeklyMap = new Map<number, boolean>(
      weekly?.map((w: { day_of_week: number; is_working: boolean }) => [
        w.day_of_week,
        w.is_working,
      ])
    );

    const isWorking = weeklyMap.get(dayOfWeek) === true;
    const isClosed = override?.is_closed === true;

    return NextResponse.json({
      available: isWorking && !isClosed,
    });
  } catch (err) {
    console.error("🔥 AVAILABILITY API ERROR", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
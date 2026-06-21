import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import { addDays, format } from "date-fns";
import { jsDayToScheduleDay } from "@/lib/schedule/time";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!barberId || !from || !to) {
      return NextResponse.json({
        availableDays: [],
        weeklySchedule: [],
        overrides: [],
      });
    }

    const { data: weekly } = await supabase
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", barberId);

    const { data: overrides } = await supabase
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", barberId);

    const availableDays: string[] = [];

    let current = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");

    while (current <= end) {
      const dateStr = format(current, "yyyy-MM-dd");
      const day = jsDayToScheduleDay(dateStr);

      const schedule = weekly?.find((w) => w.day_of_week === day);
      const override = overrides?.find((o) => o.date === dateStr);
      const resolved = resolveDaySchedule(schedule, override);

      if (resolved.isWorking) {
        availableDays.push(dateStr);
      }

      current = addDays(current, 1);
    }

    return NextResponse.json({
      availableDays,
      weeklySchedule: weekly ?? [],
      overrides: overrides ?? [],
    });
  } catch (err) {
    console.error("AVAILABILITY ERROR:", err);
    return NextResponse.json({
      availableDays: [],
      weeklySchedule: [],
      overrides: [],
    });
  }
}

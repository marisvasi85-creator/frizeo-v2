import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, format } from "date-fns";

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

    // 🔥 WEEKLY
    const { data: weekly } = await supabase
      .from("barber_weekly_schedule")
      .select("day_of_week, is_working")
      .eq("barber_id", barberId);

    // 🔥 OVERRIDES
    const { data: overrides } = await supabase
      .from("barber_day_overrides")
      .select("date, is_closed")
      .eq("barber_id", barberId);

    // 🔥 BOOKINGS
    const { data: bookings } = await supabase
      .from("bookings")
      .select("date, status")
      .eq("barber_id", barberId)
      .in("status", ["confirmed", "pending"]);

    const bookingsMap = new Map<string, number>();

    bookings?.forEach((b) => {
      const count = bookingsMap.get(b.date) || 0;
      bookingsMap.set(b.date, count + 1);
    });

    const availableDays: string[] = [];

    let current = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");

    while (current <= end) {
      const dateStr = format(current, "yyyy-MM-dd");

      const jsDay = current.getDay();
      const day = jsDay === 0 ? 7 : jsDay;

      const isWorking =
        weekly?.find((w) => w.day_of_week === day)?.is_working === true;

      const isClosed =
        overrides?.find((o) => o.date === dateStr)?.is_closed === true;

      const bookingsCount = bookingsMap.get(dateStr) || 0;

      const hasSlots =
        isWorking && !isClosed && bookingsCount < 20;

      if (hasSlots) {
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
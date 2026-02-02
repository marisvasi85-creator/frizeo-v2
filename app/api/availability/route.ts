import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { getAvailableSlots } from "@/lib/scheduling/getAvailableSlots";
import {
  parseISO,
  eachDayOfInterval,
  format,
} from "date-fns";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!barberId || !from || !to) {
      return NextResponse.json(
        { error: "Missing barberId / from / to" },
        { status: 400 }
      );
    }

    const startDate = parseISO(from);
    const endDate = parseISO(to);

    const days = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const daysWithSlots: string[] = [];

    // settings – o singură dată
    const { data: settings } = await supabase
      .from("barber_settings")
      .select("*")
      .eq("barber_id", barberId)
      .single();

    if (!settings) {
      return NextResponse.json({ daysWithSlots: [] });
    }

    for (const day of days) {
      const date = format(day, "yyyy-MM-dd");
      const jsDay = day.getDay();
      const dayOfWeek = jsDay === 0 ? 7 : jsDay;

      const { data: weekly } = await supabase
        .from("barber_weekly_schedule")
        .select("*")
        .eq("barber_id", barberId)
        .eq("day_of_week", dayOfWeek)
        .single();

      if (!weekly || !weekly.is_working) continue;

      const { data: override } = await supabase
        .from("barber_overrides")
        .select("*")
        .eq("barber_id", barberId)
        .eq("date", date)
        .maybeSingle();

      if (override?.is_closed) continue;

      const { data: bookings } = await supabase
        .from("bookings")
        .select("*")
        .eq("barber_id", barberId)
        .eq("date", date)
        .neq("status", "cancelled");

      const slots = getAvailableSlots({
        date,
        weekly,
        override,
        settings,
        bookings: bookings || [],
      });

      if (slots.length > 0) {
        daysWithSlots.push(date);
      }
    }

    return NextResponse.json({ daysWithSlots });
  } catch (err) {
    console.error("AVAILABILITY ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvailableSlots } from "@/lib/scheduling/getAvailableSlots";

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const date = searchParams.get("date");
    const barberServiceId = searchParams.get("barberServiceId");
    const excludeBookingId = searchParams.get("excludeBookingId");

    if (!barberId || !date || !barberServiceId) {
      return NextResponse.json(
        { error: "Missing params" },
        { status: 400 }
      );
    }

    /* =========================
       GET SERVICE DURATION
    ========================= */
    const { data: barberService } = await supabase
  .from("barber_services")
  .select("duration, service_id")
  .eq("id", barberServiceId)
  .eq("barber_id", barberId)
  .single();

    if (!barberService) {
      return NextResponse.json(
        { error: "Invalid service" },
        { status: 400 }
      );
    }

    const serviceDuration = barberService.duration;

    /* =========================
   DATE → day_of_week
========================= */

const dateObj = new Date(date + "T00:00:00");

if (isNaN(dateObj.getTime())) {
  return NextResponse.json(
    { error: "Invalid date format" },
    { status: 400 }
  );
}

// JS: 0 = Sunday, 1 = Monday...
const jsDay = dateObj.getDay();

// DB: 1 = Monday ... 7 = Sunday
const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    /* =========================
       WEEKLY
    ========================= */
    const { data: weekly } = await supabase
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", barberId)
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();

    if (!weekly) {
  return NextResponse.json({ slots: [] });
}

    /* =========================
       OVERRIDE
    ========================= */
    const { data: override } = await supabase
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", barberId)
      .eq("date", date)
      .maybeSingle();

    if (override?.is_closed === true) {
      return NextResponse.json({ slots: [] });
    }

    /* =========================
       SETTINGS (still needed)
    ========================= */
    const { data: settings } = await supabase
      .from("barber_settings")
      .select("*")
      .eq("barber_id", barberId)
      .single();

    /* =========================
       BOOKINGS
    ========================= */
    const { data: bookingsRaw } = await supabase
      .from("bookings")
      .select("*")
      .eq("barber_id", barberId)
      .eq("date", date)
      .eq("status", "confirmed");

    const bookings =
      excludeBookingId
        ? bookingsRaw?.filter((b) => b.id !== excludeBookingId)
        : bookingsRaw;

    /* =========================
       GENERATE SLOTS
    ========================= */
    const slots = getAvailableSlots({
      date,
      weekly,
      override,
      settings,
      bookings: bookings || [],
      serviceDuration, // 🔥 NOU
    });

    return NextResponse.json({ slots });
  } catch (err) {
    console.error("🔥 SLOT API ERROR", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

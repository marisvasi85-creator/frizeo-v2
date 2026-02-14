import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { getAvailableSlots } from "@/lib/scheduling/getAvailableSlots";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const barberId = searchParams.get("barberId");
    const date = searchParams.get("date");
    const excludeBookingId = searchParams.get("excludeBookingId");

    console.log("📥 /api/slots HIT");
    console.log("➡️ barberId:", barberId);
    console.log("➡️ date:", date);
    console.log("➡️ excludeBookingId:", excludeBookingId);

    if (!barberId || !date) {
      return NextResponse.json(
        { error: "Missing barberId or date" },
        { status: 400 }
      );
    }

    /* =========================
       DATE → day_of_week (1–7)
    ========================= */
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const jsDay = dateObj.getDay(); // 0–6 (Sun–Sat)
    const dayOfWeek = jsDay === 0 ? 7 : jsDay; // DB: 1–7 (Mon–Sun)

    /* =========================
       WEEKLY SCHEDULE
    ========================= */
    const { data: weekly } = await supabase
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", barberId)
      .eq("day_of_week", dayOfWeek)
      .maybeSingle();


    console.log("🗓 weekly:", weekly);

    if (!weekly || weekly.is_working !== true) {
      console.log("⛔ zi nelucrătoare");
      return NextResponse.json({ slots: [] });
    }
console.log("🧪 date:", date);
console.log("🧪 computed dayOfWeek:", dayOfWeek);
console.log("🧪 weekly result:", weekly);

    /* =========================
       OVERRIDE (opțional)
    ========================= */
    const { data: override } = await supabase
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", barberId)
      .eq("date", date)
      .maybeSingle();

    console.log("📌 override:", override);

    if (override?.is_closed === true) {
      console.log("⛔ override closed");
      return NextResponse.json({ slots: [] });
    }

    /* =========================
       SETTINGS
    ========================= */
    const { data: settings } = await supabase
      .from("barber_settings")
      .select("*")
      .eq("barber_id", barberId)
      .single();

    console.log("🧠 settings:", settings);

    if (!settings) {
      return NextResponse.json(
        { error: "Missing barber settings" },
        { status: 400 }
      );
    }

    /* =========================
       BOOKINGS
    ========================= */
    const { data: bookingsRaw } = await supabase
      .from("bookings")
      .select("*")
      .eq("barber_id", barberId)
      .eq("date", date)
      .eq("status", "confirmed")

    const bookings =
      excludeBookingId
        ? bookingsRaw?.filter((b) => b.id !== excludeBookingId)
        : bookingsRaw;

    console.log("📅 bookings:", bookings);

    /* =========================
       GENERATE SLOTS
    ========================= */
    const slots = getAvailableSlots({
      date,
      weekly,
      override,
      settings,
      bookings: bookings || [],
    });

    console.log("✅ GENERATED SLOTS:", slots);

    return NextResponse.json({ slots });
  } catch (err) {
    console.error("🔥 SLOT API ERROR", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

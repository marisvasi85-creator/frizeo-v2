import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, new_start } = body;

    if (!token || !new_start) {
      return NextResponse.json(
        { error: "Missing token or new_start" },
        { status: 400 }
      );
    }

    /* =========================
       1️⃣ FIND BOOKING BY TOKEN
    ========================= */
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("*")
      .eq("reschedule_token", token)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Invalid or expired reschedule token" },
        { status: 404 }
      );
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Booking is not active" },
        { status: 400 }
      );
    }

    /* =========================
       2️⃣ LOAD BARBER SETTINGS
       (limit hours)
    ========================= */
    const { data: settings } = await supabase
      .from("barber_settings")
      .select("cancel_limit_hours, slot_duration")
      .eq("barber_id", booking.barber_id)
      .single();

    const limitHours = settings?.cancel_limit_hours ?? 3;
    const slotDuration = settings?.slot_duration ?? 30;

    /* =========================
       3️⃣ CHECK TIME LIMIT
    ========================= */
    const bookingStart = new Date(
      `${booking.date}T${booking.start_time}`
    );

    const now = new Date();
    const diffMs = bookingStart.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < limitHours) {
      return NextResponse.json(
        {
          error: `Reprogramarea este permisă doar cu minimum ${limitHours} ore înainte.`,
        },
        { status: 400 }
      );
    }

    /* =========================
       4️⃣ CALCULATE NEW END TIME
    ========================= */
    const newStartDate = new Date(
      `${booking.date}T${new_start}`
    );

    if (isNaN(newStartDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid new_start format" },
        { status: 400 }
      );
    }

    const newEndDate = new Date(newStartDate);
    newEndDate.setMinutes(
      newEndDate.getMinutes() + slotDuration
    );

    const new_end = newEndDate
      .toTimeString()
      .slice(0, 8); // HH:mm:ss

    /* =========================
       5️⃣ UPDATE BOOKING
    ========================= */
    const { error: updateError } = await supabase
      .from("bookings")
      .update({
        start_time: new_start,
        end_time: new_end,
        rescheduled_from: booking.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 }
      );
    }

    /* =========================
       6️⃣ SUCCESS
    ========================= */
    return NextResponse.json({
      success: true,
      message: "Booking rescheduled successfully",
    });
  } catch (err) {
    console.error("RESCHEDULE ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

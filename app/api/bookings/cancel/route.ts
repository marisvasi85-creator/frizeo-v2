import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing cancel token" },
        { status: 400 }
      );
    }

    // 1️⃣ găsim booking-ul
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, barber_id, date, start_time, status")
      .eq("cancel_token", token)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Invalid cancel token" },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Booking already cancelled" },
        { status: 400 }
      );
    }

    // 2️⃣ citim regula de anulare
    const { data: settings } = await supabase
      .from("barber_settings")
      .select("cancel_limit_hours")
      .eq("barber_id", booking.barber_id)
      .single();

    const limitHours = settings?.cancel_limit_hours ?? 24;

    const bookingDateTime = new Date(
      `${booking.date}T${booking.start_time}`
    );
    const now = new Date();

    const diffHours =
      (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffHours < limitHours) {
      return NextResponse.json(
        { error: "Cancellation window expired" },
        { status: 400 }
      );
    }

    // 3️⃣ anulăm booking-ul
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

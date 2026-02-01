import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

import { sendEmail } from "@/lib/email/email";
import { cancelBookingTemplate } from "@/lib/email/templates/cancel-booking";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    // 1️⃣ Luăm booking-ul
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .single();

    if (error || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { message: "Booking already cancelled" }
      );
    }

    // 2️⃣ Anulăm booking-ul
    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (cancelError) {
      return NextResponse.json(
        { error: "Cancel failed" },
        { status: 400 }
      );
    }

    // 3️⃣ Email către CLIENT (doar dacă există email)
    if (booking.client_email) {
      const html = cancelBookingTemplate({
        clientName: booking.client_name,
        date: booking.date,
        time: `${booking.start_time} – ${booking.end_time}`,
      });

      await sendEmail({
        to: booking.client_email,
        subject: "❌ Programare anulată",
        html,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Booking cancelled",
    });
  } catch (err) {
    console.error("CANCEL ERROR", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

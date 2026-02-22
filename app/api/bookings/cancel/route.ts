import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { cancelBookingTemplate } from "@/lib/email/templates/cancel-booking";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = await createSupabaseServerClient();

    // 1️⃣ Găsim booking-ul
    const { data: booking, error: findError } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .single();

    if (findError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({
        success: true,
        message: "Booking already cancelled",
      });
    }

    // 2️⃣ Update status
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Could not cancel booking" },
        { status: 500 }
      );
    }

    // 3️⃣ Email client (dacă există)
    if (booking.client_email) {
      try {
        await sendEmail({
          to: booking.client_email,
          subject: "Programare anulată",
          html: cancelBookingTemplate({
            clientName: booking.client_name,
            date: booking.date,
            time: `${booking.start_time} – ${booking.end_time}`,
          }),
        });
      } catch (mailErr) {
        console.error("CANCEL EMAIL ERROR:", mailErr);
        // booking rămâne anulat chiar dacă mailul pică
      }
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error("CANCEL BOOKING ERROR:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

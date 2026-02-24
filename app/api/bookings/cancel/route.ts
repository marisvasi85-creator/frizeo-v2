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

    const supabase = await createSupabaseServerClient();

    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .single();

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    /* ⏰ Limită 2h */
    const bookingDateTime = new Date(
      `${booking.date}T${booking.start_time}`
    );

    if (bookingDateTime <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Nu mai poate fi anulată cu mai puțin de 2 ore înainte." },
        { status: 403 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({ success: true });
    }

    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (booking.client_email) {
      await sendEmail({
        to: booking.client_email,
        subject: "Programare anulată",
        html: cancelBookingTemplate({
          clientName: booking.client_name,
          date: booking.date,
          time: `${booking.start_time} – ${booking.end_time}`,
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
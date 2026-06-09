import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { cancelBookingTemplate } from "@/lib/email/templates/cancel-booking";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { token, bookingId } = body;

    const supabase = await createSupabaseServerClient();

    let booking = null;

    // 🔥 ADMIN
    if (bookingId) {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      booking = data;
    }

    // 🔥 PUBLIC
    if (token) {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("cancel_token", token)
        .single();

      booking = data;
    }

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // 🔥 UPDATE STATUS
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    // 🔥 EMAIL CLIENT
    if (booking.client_email) {
      await sendEmail({
        to: booking.client_email,
        subject: "Programare anulată",
        html: cancelBookingTemplate({
          clientName: booking.client_name,
          date: booking.date,
          time: `${booking.start_time} - ${booking.end_time}`,
        }),
      });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
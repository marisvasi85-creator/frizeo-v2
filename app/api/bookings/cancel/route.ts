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

    // 🔥 GET BOOKING
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .maybeSingle();

    if (error || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // 🔥 VALIDARE 2H
    const bookingTime = new Date(
      `${booking.date}T${booking.start_time}`
    );

    if (bookingTime <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
      return NextResponse.json(
        {
          error: "Nu mai poate fi anulată cu mai puțin de 2 ore înainte.",
        },
        { status: 403 }
      );
    }

    // 🔥 UPDATE
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

    // 🔥 EMAIL BARBER
    try {
      const { data: barber } = await supabase
        .from("barbers")
        .select("user_id")
        .eq("id", booking.barber_id)
        .single();

      if (barber?.user_id) {
        const { data: userData } =
          await supabase.auth.admin.getUserById(barber.user_id);

        const barberEmail = userData?.user?.email;

        if (barberEmail) {
          await sendEmail({
            to: barberEmail,
            subject: "Programare anulată",
            html: cancelBookingTemplate({
              clientName: booking.client_name,
              date: booking.date,
              time: `${booking.start_time} - ${booking.end_time}`,
            }),
          });
        }
      }
    } catch (e) {
      console.error("BARBER EMAIL ERROR:", e);
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
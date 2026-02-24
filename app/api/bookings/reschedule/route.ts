import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { rescheduleBookingTemplate } from "@/lib/email/templates/reschedule-booking";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, new_date, new_start_time, new_end_time } = body ?? {};

    if (!token || !new_date || !new_start_time || !new_end_time) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    const { data: oldBooking } = await supabase
      .from("bookings")
      .select("*")
      .eq("reschedule_token", token)
      .eq("status", "confirmed")
      .single();

    if (!oldBooking) {
      return NextResponse.json(
        { error: "Programare invalidă sau expirată" },
        { status: 404 }
      );
    }

    /* ⏰ Limită 2h */
    const bookingDateTime = new Date(
      `${oldBooking.date}T${oldBooking.start_time}`
    );

    if (bookingDateTime <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Nu mai poate fi reprogramată cu < 2 ore înainte." },
        { status: 403 }
      );
    }

    await supabase
      .from("bookings")
      .update({
        status: "rescheduled",
        reschedule_token: null,
      })
      .eq("id", oldBooking.id);

    const { data: newBooking, error } =
      await supabase.rpc("create_booking_safe", {
        p_barber_id: oldBooking.barber_id,
        p_service_id: oldBooking.service_id,
        p_date: new_date,
        p_start: new_start_time,
        p_end: new_end_time,
        p_client_name: oldBooking.client_name,
        p_client_phone: oldBooking.client_phone,
        p_client_email: oldBooking.client_email,
      });

    if (error || !newBooking) {
      return NextResponse.json(
        { error: "Slot indisponibil." },
        { status: 400 }
      );
    }

    if (oldBooking.client_email) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

  await sendEmail({
    to: oldBooking.client_email,
    subject: "Programare reprogramată",
    html: rescheduleBookingTemplate({
      clientName: oldBooking.client_name,
      oldDate: oldBooking.date,
      oldTime: `${oldBooking.start_time} – ${oldBooking.end_time}`,
      newDate: new_date,
      newTime: `${new_start_time} – ${new_end_time}`,
      cancelUrl: `${baseUrl}/cancel/${newBooking.cancel_token}`,
    }),
  });
}

    return NextResponse.json({
      success: true,
      bookingId: newBooking.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
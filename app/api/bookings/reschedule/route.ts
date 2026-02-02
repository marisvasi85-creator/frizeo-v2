import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { rescheduleBookingTemplate } from "@/lib/email/templates/reschedule-booking";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      token,
      new_date,
      new_start_time,
      new_end_time,
    } = body ?? {};

    /* =========================
       1️⃣ VALIDARE
    ========================= */
    if (!token || !new_date || !new_start_time || !new_end_time) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    /* =========================
       2️⃣ BOOKING VECHI (CONFIRMED)
    ========================= */
    const { data: oldBooking, error: findError } = await supabase
      .from("bookings")
      .select("*")
      .eq("reschedule_token", token)
      .eq("status", "confirmed")
      .single();

    if (findError || !oldBooking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    /* =========================
       3️⃣ ANULĂM BOOKING-UL VECHI
       ⚠️ IMPORTANT: înainte de a crea noul
    ========================= */
    const { error: cancelError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", oldBooking.id);

    if (cancelError) {
      console.error("CANCEL OLD BOOKING ERROR:", cancelError);
      return NextResponse.json(
        { error: "Could not cancel old booking" },
        { status: 500 }
      );
    }

    /* =========================
       4️⃣ CREĂM BOOKING NOU (SAFE)
    ========================= */
    const { data: newBooking, error: createError } =
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

    if (createError || !newBooking) {
      console.error("RESCHEDULE CREATE ERROR:", createError);

      // rollback minimal: slotul vechi rămâne liber (corect)
      return NextResponse.json(
        { error: createError?.message ?? "Could not reschedule booking" },
        { status: 500 }
      );
    }

    const oldTime = `${oldBooking.start_time} – ${oldBooking.end_time}`;
    const newTime = `${new_start_time} – ${new_end_time}`;

    /* =========================
       5️⃣ EMAIL CLIENT
    ========================= */
    try {
      if (oldBooking.client_email) {
        await sendEmail({
          to: oldBooking.client_email,
          subject: "Programare reprogramată",
          html: rescheduleBookingTemplate({
            clientName: oldBooking.client_name,
            oldDate: oldBooking.date,
            oldTime,
            newDate: new_date,
            newTime,
            cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/cancel/${newBooking.cancel_token}`,
          }),
        });
      }
    } catch (mailErr) {
      console.error("RESCHEDULE EMAIL ERROR:", mailErr);
    }

    /* =========================
       6️⃣ SUCCESS
    ========================= */
    return NextResponse.json({
      success: true,
      bookingId: newBooking.id,
      cancelToken: newBooking.cancel_token,
      rescheduleToken: newBooking.reschedule_token,
    });
  } catch (err) {
    console.error("RESCHEDULE ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

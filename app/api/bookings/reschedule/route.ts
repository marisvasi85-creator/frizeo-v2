import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
       1️⃣ VALIDARE INPUT
    ========================= */
    if (!token || !new_date || !new_start_time || !new_end_time) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    /* =========================
       2️⃣ GĂSIM BOOKING-UL VECHI (TOKEN VALID)
    ========================= */
    const supabase = await createSupabaseServerClient();

    const { data: oldBooking, error: findError } = await supabase
      .from("bookings")
      .select("*")
      .eq("reschedule_token", token)
      .eq("status", "confirmed")
      .gt("reschedule_token_expires_at", new Date().toISOString())
      .single();

    if (findError || !oldBooking) {
      return NextResponse.json(
        { error: "Programare invalidă sau expirată" },
        { status: 404 }
      );
    }
/* =========================
   ⏰ LIMITĂ 2 ORE ÎNAINTE
========================= */
const bookingDateTime = new Date(
  `${oldBooking.date}T${oldBooking.start_time}`
);

const nowPlus2h = new Date(Date.now() + 2 * 60 * 60 * 1000);

if (bookingDateTime <= nowPlus2h) {
  return NextResponse.json(
    {
      error:
        "Programarea nu mai poate fi reprogramată cu mai puțin de 2 ore înainte.",
    },
    { status: 403 }
  );
}

    /* =========================
       3️⃣ MARCĂM BOOKING-UL VECHI
    ========================= */
    const { error: updateOldError } = await supabase
      .from("bookings")
      .update({
        status: "rescheduled",
        reschedule_token: null,
        reschedule_token_expires_at: null,
      })
      .eq("id", oldBooking.id);

    if (updateOldError) {
      console.error("UPDATE OLD BOOKING ERROR:", updateOldError);
      return NextResponse.json(
        { error: "Could not update old booking" },
        { status: 500 }
      );
    }

    /* =========================
       4️⃣ CREĂM BOOKING NOU (RPC SAFE)
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
      return NextResponse.json(
        { error: createError?.message ?? "Could not reschedule booking" },
        { status: 500 }
      );
    }

    /* =========================
       5️⃣ GENERĂM TOKEN NOU PENTRU BOOKING-UL NOU
    ========================= */
    const newRescheduleToken = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    await supabase
      .from("bookings")
      .update({
        reschedule_token: newRescheduleToken,
        reschedule_token_expires_at: expiresAt,
      })
      .eq("id", newBooking.id);

    /* =========================
       6️⃣ EMAIL CLIENT
    ========================= */
    try {
      if (oldBooking.client_email) {
        await sendEmail({
          to: oldBooking.client_email,
          subject: "Programare reprogramată",
          html: rescheduleBookingTemplate({
            clientName: oldBooking.client_name,
            oldDate: oldBooking.date,
            oldTime: `${oldBooking.start_time} – ${oldBooking.end_time}`,
            newDate: new_date,
            newTime: `${new_start_time} – ${new_end_time}`,
            cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/cancel/${newBooking.cancel_token}`,
          }),
        });
      }
    } catch (mailErr) {
      console.error("RESCHEDULE EMAIL ERROR:", mailErr);
    }

    /* =========================
       7️⃣ SUCCESS
    ========================= */
    return NextResponse.json({
      success: true,
      bookingId: newBooking.id,
      cancelToken: newBooking.cancel_token,
      rescheduleToken: newRescheduleToken,
    });
  } catch (err) {
    console.error("RESCHEDULE ERROR:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

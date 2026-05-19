import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { rescheduleConfirmationTemplate } from "@/lib/email/templates/reschedule-confirmation";
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const { token, new_date, new_start_time, new_end_time } = body;

    if (!token || !new_date || !new_start_time || !new_end_time) {
      return NextResponse.json(
        { error: "Date invalide" },
        { status: 400 }
      );
    }

    // 🔥 GET BOOKING EXISTENT
    const { data: oldBooking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("reschedule_token", token)
      .eq("status", "confirmed")
      .single();

    if (error || !oldBooking) {
      return NextResponse.json(
        { error: "Link invalid sau expirat" },
        { status: 404 }
      );
    }

    if (
  oldBooking.date === new_date &&
  oldBooking.start_time === new_start_time
) {
  return NextResponse.json(
    { error: "Ai selectat aceeași oră" },
    { status: 400 }
  );
}
    // 🔥 BLOCK 2H
    const bookingTime = new Date(
      `${oldBooking.date}T${oldBooking.start_time}`
    );

    if (bookingTime <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Nu mai poate fi reprogramată" },
        { status: 403 }
      );
    }

    // 🔥 SERVICE CORECT
    let barberServiceId = oldBooking.barber_service_id;

    // fallback pentru date vechi
    if (!barberServiceId && oldBooking.service_id) {
      const { data: bs } = await supabase
        .from("barber_services")
        .select("id")
        .eq("service_id", oldBooking.service_id)
        .eq("barber_id", oldBooking.barber_id)
        .single();

      barberServiceId = bs?.id;
    }

    if (!barberServiceId) {
      return NextResponse.json(
        { error: "Serviciu invalid (lipsă barber_service_id)" },
        { status: 400 }
      );
    }

    // 🔥 CREATE BOOKING NOU (RPC CORECT)
    const { data: newBooking, error: rpcError } =
  await supabase.rpc("create_booking_safe_v2", {
    p_barber_id: oldBooking.barber_id,
    p_barber_service_id: barberServiceId,
    p_date: new_date,
    p_start: new_start_time,
    p_end: new_end_time,
    p_client_name: oldBooking.client_name,
    p_client_phone: oldBooking.client_phone,
    p_client_email: oldBooking.client_email,
    p_reschedule_count: (oldBooking.reschedule_count || 0) + 1,

    // 🔥 CHEIA PROBLEMEI
    p_exclude_booking_id: oldBooking.id,
  });

    if (rpcError || !newBooking) {
      console.error("RPC ERROR:", rpcError);
      return NextResponse.json(
        { error: "Slot ocupat" },
        { status: 400 }
      );
    }
let barberEmail: string | null = null;

try {
  const { data: barber } = await supabase
    .from("barbers")
    .select("user_id")
    .eq("id", oldBooking.barber_id)
    .single();

  if (barber?.user_id) {
    const { data: userData } =
      await supabase.auth.admin.getUserById(barber.user_id);

    barberEmail = userData?.user?.email || null;
  }
} catch (e) {
  console.error("BARBER ERROR:", e);
}

if (barberEmail) {
  await sendEmail({
    to: barberEmail,
    subject: "Programare reprogramată",
    html: `Programare modificată:
    ${new_date} ${new_start_time}`,
  });
}
    // 🔥 ANULEAZĂ VECHIUL BOOKING
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        reschedule_token: null,
      })
      .eq("id", oldBooking.id);

    // 🔥 EMAIL CLIENT
if (oldBooking.client_email) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const cancelLink = `${baseUrl}/cancel/${newBooking.cancel_token}`;
    const rescheduleLink = `${baseUrl}/reschedule/${newBooking.reschedule_token}`;

    const html = rescheduleConfirmationTemplate({
      barberName: "Barber", // poți pune din DB dacă vrei
      date: new_date,
      time: new_start_time,
      cancelLink,
      rescheduleLink,
    });

    await sendEmail({
      to: oldBooking.client_email,
      subject: "Programare reprogramată",
      html,
    });

  } catch (e) {
    console.error("EMAIL ERROR:", e);
  }
}

    return NextResponse.json({
      success: true,
      bookingId: newBooking.id,
    });

  } catch (err) {
    console.error("RESCHEDULE ERROR:", err);

    return NextResponse.json(
      { error: "Eroare internă (rescheduling)" },
      { status: 500 }
    );
  }
}
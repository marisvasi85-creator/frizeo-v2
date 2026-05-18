import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";


export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const { token, new_date, new_start_time, new_end_time } = body;

    if (!token || !new_date || !new_start_time || !new_end_time) {
      return NextResponse.json(
        { error: "Date incomplete" },
        { status: 400 }
      );
    }

    // ============================
    // 🔥 GET BOOKING VECHI
    // ============================
    const { data: oldBooking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("reschedule_token", token)
      .eq("status", "confirmed")
      .single();

    if (fetchError || !oldBooking) {
      return NextResponse.json(
        { error: "Link invalid sau expirat" },
        { status: 404 }
      );
    }

    // ============================
    // 🔥 VALIDARE 2H
    // ============================
    const bookingTime = new Date(
      `${oldBooking.date}T${oldBooking.start_time}`
    );

    const now = new Date();

    if (bookingTime <= new Date(now.getTime() + 2 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Nu mai poate fi reprogramată (sub 2h)" },
        { status: 403 }
      );
    }

    // ============================
    // 🔥 SCOATEM TEMPORAR DIN CONFLICT
    // ============================
    const { error: tempError } = await supabase
      .from("bookings")
      .update({ status: "rescheduling" })
      .eq("id", oldBooking.id);

    if (tempError) {
      return NextResponse.json(
        { error: "Eroare internă (rescheduling)" },
        { status: 500 }
      );
    }

    // ============================
    // 🔥 CREARE BOOKING NOU (SAFE)
    // ============================
    const { data: newBooking, error: rpcError } = await supabase.rpc(
      "create_booking_safe",
      {
        p_barber_id: oldBooking.barber_id,
        p_barber_service_id: oldBooking.barber_service_id,
        p_date: new_date,
        p_start: new_start_time,
        p_end: new_end_time,
        p_client_name: oldBooking.client_name,
        p_client_phone: oldBooking.client_phone,
        p_client_email: oldBooking.client_email,
      }
    );

    // ============================
    // 🔴 FAIL → ROLLBACK
    // ============================
    if (rpcError || !newBooking) {
      await supabase
        .from("bookings")
        .update({ status: "confirmed" })
        .eq("id", oldBooking.id);

      return NextResponse.json(
        { error: "Slot ocupat" },
        { status: 400 }
      );
    }

    // ============================
    // ✅ SUCCESS → FINALIZARE
    // ============================
    await supabase
      .from("bookings")
      .update({
        status: "rescheduled",
        reschedule_token: null,
      })
      .eq("id", oldBooking.id);

    return NextResponse.json({
      success: true,
      bookingId: newBooking.id,
    });

  } catch (err) {
    console.error("RESCHEDULE ERROR:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
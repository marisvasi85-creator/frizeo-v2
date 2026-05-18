import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const { token, new_date, new_start_time, new_end_time } = body;

    // 🔥 GET BOOKING
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

    // 🔥 GET SERVICE CORECT
    let barberServiceId = oldBooking.barber_service_id;

    // fallback dacă e null (date vechi)
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

    // 🔥 CREATE NEW BOOKING (FIX REAL)
    const { data: newBooking, error: rpcError } =
      await supabase.rpc("create_booking_safe", {
        p_barber_id: oldBooking.barber_id,
        p_barber_service_id: barberServiceId,
        p_date: new_date,
        p_start: new_start_time,
        p_end: new_end_time,
        p_client_name: oldBooking.client_name,
        p_client_phone: oldBooking.client_phone,
        p_client_email: oldBooking.client_email,

        // 🔥 CRITICE (FARA ASTEA NU MERGE)
        p_reschedule_count: (oldBooking.reschedule_count || 0) + 1,
        p_rescheduled_from: oldBooking.id,
      });

    if (rpcError || !newBooking) {
      console.error("RPC ERROR:", rpcError);
      return NextResponse.json(
        { error: "Slot ocupat" },
        { status: 400 }
      );
    }

    // 🔥 ANULEAZĂ VECHIUL BOOKING
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
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
      { error: "Eroare internă (rescheduling)" },
      { status: 500 }
    );
  }
}
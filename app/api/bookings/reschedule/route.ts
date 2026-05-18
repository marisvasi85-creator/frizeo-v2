import { NextResponse } from "next/server";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export async function POST(req: Request) {
  try {
    const supabase = createSupabasePublicClient();
    const body = await req.json();

    const { token, new_date, new_start_time, new_end_time } = body;

    const { data: oldBooking } = await supabase
      .from("bookings")
      .select("*")
      .eq("reschedule_token", token)
      .eq("status", "confirmed")
      .single();

    if (!oldBooking) {
      return NextResponse.json(
        { error: "Link invalid sau expirat" },
        { status: 404 }
      );
    }

    // blocare 2h
    const bookingTime = new Date(
      `${oldBooking.date}T${oldBooking.start_time}`
    );

    if (bookingTime <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Nu mai poate fi reprogramată" },
        { status: 403 }
      );
    }

    const { data: newBooking, error } = await supabase.rpc(
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

    if (error || !newBooking) {
      return NextResponse.json(
        { error: "Slot ocupat" },
        { status: 400 }
      );
    }

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
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
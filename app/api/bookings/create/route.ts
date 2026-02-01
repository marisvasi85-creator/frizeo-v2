import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

function isValidTime(t: string) {
  return /^\d{2}:\d{2}$/.test(t);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      barberId,
      serviceId,
      date,            // YYYY-MM-DD
      start_time,      // HH:mm
      end_time,        // HH:mm
      client_name,
      client_phone,
      client_email,
    } = body ?? {};

    // 1️⃣ Validări minime
    if (
      !barberId ||
      !serviceId ||
      !date ||
      !start_time ||
      !end_time ||
      !client_name ||
      !client_phone
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!isValidTime(start_time) || !isValidTime(end_time)) {
      return NextResponse.json(
        { error: "Invalid time format" },
        { status: 400 }
      );
    }

    // 2️⃣ Insert (DB are deja UNIQUE(barber_id, date, start_time))
    const { data, error } = await supabase.rpc("create_booking_safe", {
  p_barber_id: barberId,
  p_service_id: serviceId,
  p_date: date,
  p_start: start_time,
  p_end: end_time,
  p_client_name: client_name,
  p_client_phone: client_phone,
  p_client_email: client_email ?? null,
});

    if (error) {
  if (error.message.includes("SLOT_TAKEN")) {
    return NextResponse.json(
      { error: "Slot already booked" },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { error: error.message },
    { status: 500 }
  );
}

    // 3️⃣ Success
    return NextResponse.json({
      success: true,
      bookingId: data.id,
      cancelToken: data.cancel_token,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

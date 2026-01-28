import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json();

  const { error } = await supabase
    .from("bookings")
    .insert({
      barber_id: body.barber_id,
      service_id: body.service_id,
      booking_date: body.booking_date,
      booking_time: body.booking_time,
      client_name: body.client_name,
      client_phone: body.client_phone,
      client_email: body.client_email,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

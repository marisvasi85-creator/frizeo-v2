import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(req: Request) {
  const body = await req.json();
  const { barberId, date, time, clientName, clientPhone } = body;

  if (!barberId || !date || !time || !clientName || !clientPhone) {
    return NextResponse.json({ error: "Date incomplete" }, { status: 400 });
  }

  const { error } = await supabaseServer.from("bookings").insert({
    barber_id: barberId,
    booking_date: date,
    booking_time: time,
    client_name: clientName,
    client_phone: clientPhone,
    status: "confirmed",
    cancel_token: crypto.randomUUID(),
  });

  if (error?.code === "23505") {
    return NextResponse.json(
      { error: "Slotul a fost deja rezervat" },
      { status: 409 }
    );
  }

  if (error) {
    console.error(error);
    return NextResponse.json({ error: "Eroare server" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

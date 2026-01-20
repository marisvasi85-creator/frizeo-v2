import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { sendBookingConfirmationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      barberId,
      date,
      time,
      clientName,
      clientPhone,
      clientEmail,
    } = body;

    if (
      !barberId ||
      !date ||
      !time ||
      !clientName ||
      !clientPhone ||
      !clientEmail
    ) {
      return NextResponse.json(
        { error: "Date incomplete" },
        { status: 400 }
      );
    }

    const supabase = supabaseServer();

    /* ======================================================
       1️⃣ Luăm frizerul + tenant_id
    ====================================================== */
    const { data: barber, error: barberError } = await supabase
      .from("barbers")
      .select("id, tenant_id")
      .eq("id", barberId)
      .single();

    if (!barber || barberError) {
      return NextResponse.json(
        { error: "Frizer inexistent" },
        { status: 404 }
      );
    }

    const tenantId = barber.tenant_id;

    /* ======================================================
       2️⃣ Creăm booking-ul
    ====================================================== */
    const cancelToken = randomUUID();

    const { error: insertError } = await supabase
      .from("bookings")
      .insert({
        tenant_id: tenantId,
        barber_id: barberId,
        booking_date: date,
        booking_time: time,
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        status: "confirmed",
        cancel_token: cancelToken,
      });

    if (insertError?.code === "23505") {
      return NextResponse.json(
        { error: "Slotul a fost deja rezervat" },
        { status: 409 }
      );
    }

    if (insertError) {
      console.error(insertError);
      return NextResponse.json(
        { error: "Eroare server" },
        { status: 500 }
      );
    }

    /* ======================================================
       3️⃣ Email confirmare
    ====================================================== */
    const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cancel/${cancelToken}`;

    await sendBookingConfirmationEmail({
      to: clientEmail,
      name: clientName,
      date,
      time,
      cancelUrl,
    });

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Eroare server" },
      { status: 500 }
    );
  }
}

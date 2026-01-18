import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { message: "Token lipsă" },
        { status: 400 }
      );
    }

    /* ===============================
       1️⃣ Luăm programarea după token
    =============================== */
    const { data: booking, error: bookingError } =
      await supabaseAdmin
        .from("bookings")
        .select(
          "id, barber_id, booking_date, booking_time, status"
        )
        .eq("cancel_token", token)
        .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { message: "Programarea nu există" },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { message: "Programarea este deja anulată" },
        { status: 400 }
      );
    }

    /* ===============================
       2️⃣ Calculăm timpul programării
    =============================== */
    const bookingDateTime = new Date(
      `${booking.booking_date}T${booking.booking_time}`
    );

    /* ===============================
       3️⃣ Luăm regula frizerului
    =============================== */
    const { data: settings } = await supabaseAdmin
      .from("barber_settings")
      .select("cancel_limit_hours")
      .eq("barber_id", booking.barber_id)
      .single();

    const cancelLimitHours = settings?.cancel_limit_hours ?? 24;
    const cancelLimitMs = cancelLimitHours * 60 * 60 * 1000;

    /* ===============================
       4️⃣ Verificăm dacă e prea târziu
    =============================== */
    if (
      Date.now() >
      bookingDateTime.getTime() - cancelLimitMs
    ) {
      return NextResponse.json(
        {
          message: `Anularea nu mai este permisă cu mai puțin de ${cancelLimitHours}h înainte`,
        },
        { status: 410 }
      );
    }

    /* ===============================
       5️⃣ Anulăm programarea
    =============================== */
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (updateError) {
      return NextResponse.json(
        { message: "Eroare la anulare" },
        { status: 500 }
      );
    }

    /* ===============================
       ✅ SUCCES
    =============================== */
    return NextResponse.json(
      { success: true, message: "Programarea a fost anulată" },
      { status: 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { message: "Eroare internă server" },
      { status: 500 }
    );
  }
}

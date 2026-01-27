import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token lipsă" },
        { status: 400 }
      );
    }

    // 1️⃣ Booking după token
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, barber_id, booking_date, booking_time, status, client_email"
      )
      .eq("cancel_token", token)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: "Programare invalidă" },
        { status: 404 }
      );
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Programarea nu mai poate fi anulată" },
        { status: 400 }
      );
    }

    // 2️⃣ cancel_limit_hours
    const { data: settings } = await supabase
      .from("barber_settings")
      .select("cancel_limit_hours")
      .eq("barber_id", booking.barber_id)
      .single();

    const limit = settings?.cancel_limit_hours ?? 24;

    const bookingDateTime = new Date(
      `${booking.booking_date}T${booking.booking_time}`
    );
    const diffHours =
      (bookingDateTime.getTime() - Date.now()) /
      (1000 * 60 * 60);

    if (diffHours < limit) {
      return NextResponse.json(
        {
          error: `Programarea nu mai poate fi anulată cu mai puțin de ${limit}h înainte`,
        },
        { status: 403 }
      );
    }

    // 3️⃣ UPDATE
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    // 4️⃣ LOG
    await supabase.from("booking_cancellations").insert({
      booking_id: booking.id,
      cancelled_by: "client",
    });

    // 5️⃣ EMAIL ANULARE
    if (booking.client_email) {
      await sendEmail({
        to: booking.client_email,
        subject: "Programare anulată",
        html: `
          <h2>Programarea a fost anulată</h2>
          <p><strong>Data:</strong> ${booking.booking_date}</p>
          <p><strong>Ora:</strong> ${booking.booking_time}</p>
        `,
      });
    }

    return NextResponse.json(
      { success: true, message: "Programare anulată" },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Eroare server" },
      { status: 500 }
    );
  }
}

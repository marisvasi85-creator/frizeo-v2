import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { cancelBookingTemplate } from "@/lib/email/templates/cancel-booking";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();

    // 🔥 1. GET BOOKING
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("cancel_token", token)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // 🔥 2. VALIDARE 2H (CORECTĂ)
    const bookingDateTime = new Date(
      `${booking.date}T${booking.start_time}`
    );

    const now = new Date();
    const diffMs = bookingDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 2) {
      return NextResponse.json(
        {
          error:
            "Nu mai poate fi anulată cu mai puțin de 2 ore înainte.",
        },
        { status: 403 }
      );
    }

    // 🔥 3. DEJA ANULAT
    if (booking.status === "cancelled") {
      return NextResponse.json({ success: true });
    }

    // 🔥 4. UPDATE (cu verificare)
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Eroare la anulare" },
        { status: 500 }
      );
    }

    // 🔥 5. EMAIL CLIENT
    if (booking.client_email) {
      try {
        await sendEmail({
          to: booking.client_email,
          subject: "Programare anulată",
          html: cancelBookingTemplate({
            clientName: booking.client_name,
            date: booking.date,
            time: `${booking.start_time} – ${booking.end_time}`,
          }),
        });
      } catch (e) {
        console.error("EMAIL ERROR:", e);
      }
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
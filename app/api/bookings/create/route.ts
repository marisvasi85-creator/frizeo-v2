import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";
import { barberNewBookingTemplate } from "@/lib/email/templates/barber-new-booking";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const {
      bookingId,
      client_name,
      client_phone,
      client_email,
    } = body;

    if (!bookingId || !client_name || !client_phone) {
      return NextResponse.json(
        { error: "Date incomplete" },
        { status: 400 }
      );
    }

    // 🔥 CONFIRM BOOKING
    const { data, error } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        client_name,
        client_phone,
        client_email: client_email || null,
      })
      .eq("id", bookingId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Slot indisponibil sau expirat" },
        { status: 400 }
      );
    }

    // ============================
    // 🔥 GET SERVICE NAME
    // ============================
    const { data: service } = await supabase
      .from("barber_services")
      .select("display_name")
      .eq("id", data.service_id)
      .single();

    const serviceName = service?.display_name || "Serviciu";

    // ============================
    // 🔥 GET BARBER
    // ============================
    let barberEmail: string | null = null;
    let barberName: string = "Barber";

    try {
      const { data: barber } = await supabase
        .from("barbers")
        .select("user_id, display_name")
        .eq("id", data.barber_id)
        .single();

      barberName = barber?.display_name || "Barber";

      if (barber?.user_id) {
        const { data: userData } =
          await supabase.auth.admin.getUserById(barber.user_id);

        barberEmail = userData?.user?.email || null;
      }
    } catch (e) {
      console.error("BARBER ERROR:", e);
    }

    // ============================
    // 🔥 FORMAT
    // ============================
    const formattedDate = new Date(data.date).toLocaleDateString("ro-RO");
    const formattedTime = data.start_time?.slice(0, 5);

    // 🔥 URL-uri (placeholder)
    const cancelUrl = "#";
    const rescheduleUrl = "#";

    // ============================
    // 📩 EMAIL CLIENT
    // ============================
    if (client_email) {
      try {
        await sendEmail({
          to: client_email,
          subject: "Programare confirmată",
          html: clientConfirmationTemplate({
            clientName: client_name,
            barberName,
            serviceName,
            date: formattedDate,
            time: formattedTime,
            cancelUrl,
            rescheduleUrl,
          }),
        });
      } catch (e) {
        console.error("CLIENT EMAIL ERROR:", e);
      }
    }

    // ============================
    // 📩 EMAIL BARBER
    // ============================
    if (barberEmail) {
      try {
        await sendEmail({
          to: barberEmail,
          subject: "Programare nouă",
          html: barberNewBookingTemplate({
            clientName: client_name,
            phone: client_phone,
            serviceName,
            date: formattedDate,
            time: formattedTime,
          }),
        });
      } catch (e) {
        console.error("BARBER EMAIL ERROR:", e);
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: data.id,
    });

  } catch (err) {
    console.error("CREATE ERROR:", err);

    return NextResponse.json(
      { error: "Eroare server" },
      { status: 500 }
    );
  }
}
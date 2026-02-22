import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";

export async function POST(req: NextRequest) {
  try {
        const supabase = await createSupabaseServerClient(); // 🔥 ADĂUGAT
    const body = await req.json();

    const {
      barberId,
      serviceId,
      date,
      start_time,
      end_time,
      client_name,
      client_phone,
      client_email,
    } = body ?? {};

    // 1️⃣ Validări hard
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

    const { data: barberService } = await supabase
  .from("barber_services")
  .select("service_id")
  .eq("id", serviceId)
  .eq("barber_id", barberId)
  .single();

if (!barberService) {
  return NextResponse.json(
    { error: "Invalid service" },
    { status: 400 }
  );
}
    // 2️⃣ Creare booking (RPC)
    const { data, error } = await supabase.rpc("create_booking_safe", {
      p_barber_id: barberId,
p_service_id: barberService.service_id,      p_date: date,
      p_start: start_time,
      p_end: end_time,
      p_client_name: client_name,
      p_client_phone: client_phone,
      p_client_email: client_email || null,
    });

    if (error) {
      console.error("CREATE BOOKING RPC ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // 3️⃣ Email confirmare client (DOAR dacă există email)
    if (client_email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;

      await sendEmail({
        to: client_email,
        subject: "Confirmare programare",
        html: clientConfirmationTemplate({
          barberName: "Frizerul tău", // ⬅️ poți pune din DB ulterior
          date,
          time: `${start_time} – ${end_time}`,
          cancelLink: `${baseUrl}/cancel/${data.cancel_token}`,
          rescheduleLink: `${baseUrl}/reschedule/${data.reschedule_token}`,
        }),
      });
    }

    return NextResponse.json({
      success: true,
      bookingId: data.id,
      cancelToken: data.cancel_token,
    });
  } catch (err) {
    console.error("CREATE BOOKING ERROR:", err);
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

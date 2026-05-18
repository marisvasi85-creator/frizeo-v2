import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";
import { barberNewBookingTemplate } from "@/lib/email/templates/barber-new-booking";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const {
      barber_id,
      service_id,
      date,
      start_time,
      end_time,
      client_name,
      client_phone,
      client_email,
    } = body;

    // ============================
    // 🔴 VALIDARE
    // ============================
    if (!barber_id || !service_id || !date || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Date incomplete" },
        { status: 400 }
      );
    }

    // ============================
    // 🔥 TOKENS
    // ============================
    const cancelToken = randomUUID();
    const rescheduleToken = randomUUID();

    // ============================
    // 🔥 INSERT BOOKING
    // ============================
    const { data, error } = await supabase
      .from("bookings")
      .insert({
        barber_id,
        service_id,
        date,
        start_time,
        end_time,
        client_name,
        client_phone,
        client_email: client_email || null,
        status: "confirmed",
        cancel_token: cancelToken,
        reschedule_token: rescheduleToken,
      })
      .select()
      .single();

    if (error) {
      console.error("INSERT ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // ============================
    // 🔥 SERVICE
    // ============================
    const { data: service } = await supabase
      .from("barber_services")
      .select("display_name")
      .eq("id", service_id)
      .single();

    const serviceName = service?.display_name || "Serviciu";

    // ============================
    // 🔥 BARBER
    // ============================
    let barberEmail: string | null = null;
    let barberName = "Barber";

    const { data: barber } = await supabase
      .from("barbers")
      .select("user_id, display_name")
      .eq("id", barber_id)
      .single();

    barberName = barber?.display_name || "Barber";

    if (barber?.user_id) {
      const { data: userData } =
        await supabase.auth.admin.getUserById(barber.user_id);

      barberEmail = userData?.user?.email || null;
    }

    // ============================
    // 🔥 FORMAT
    // ============================
    const formattedDate = new Date(data.date).toLocaleDateString("ro-RO");
    const formattedTime = data.start_time.slice(0, 5);

    // ============================
    // 🔥 BASE URL (FIX IMPORTANT)
    // ============================
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
        ? process.env.NEXT_PUBLIC_APP_URL
        : "http://localhost:3000";

    const cancelUrl = `${baseUrl}/cancel/${cancelToken}`;
    const rescheduleUrl = `${baseUrl}/reschedule/${rescheduleToken}`;

    // ============================
    // 🔍 DEBUG (FOARTE IMPORTANT)
    // ============================
    console.log("===== EMAIL DEBUG =====");
    console.log("BASE URL:", baseUrl);
    console.log("CANCEL URL:", cancelUrl);
    console.log("RESCHEDULE URL:", rescheduleUrl);
    console.log("CLIENT EMAIL:", client_email);
    console.log("BARBER EMAIL:", barberEmail);
    console.log("=======================");

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

    // ============================
    // ✅ RESPONSE
    // ============================
    return NextResponse.json({
      success: true,
      bookingId: data.id,
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
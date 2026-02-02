import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";

/* ================= VALIDATORS ================= */

const isValidName = (v: string) =>
  typeof v === "string" && v.trim().length >= 2;

const isValidPhoneRO = (v: string) =>
  /^07\d{8}$/.test(v); // 0700000000

const isValidEmail = (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const isValidTime = (t: string) =>
  /^\d{2}:\d{2}$/.test(t);

/* ================= ROUTE ================= */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      barberId,
      serviceId,
      date,          // YYYY-MM-DD
      start_time,    // HH:mm
      end_time,      // HH:mm
      client_name,
      client_phone,
      client_email,  // optional
    } = body ?? {};

    /* ================= REQUIRED ================= */

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
        { error: "Câmpuri obligatorii lipsă" },
        { status: 400 }
      );
    }

    /* ================= FORMAT ================= */

    if (!isValidName(client_name)) {
      return NextResponse.json(
        { error: "Numele este prea scurt" },
        { status: 400 }
      );
    }

    if (!isValidPhoneRO(client_phone)) {
      return NextResponse.json(
        { error: "Telefon invalid (format RO)" },
        { status: 400 }
      );
    }

    if (client_email && !isValidEmail(client_email)) {
      return NextResponse.json(
        { error: "Email invalid" },
        { status: 400 }
      );
    }

    if (!isValidTime(start_time) || !isValidTime(end_time)) {
      return NextResponse.json(
        { error: "Format oră invalid" },
        { status: 400 }
      );
    }

    /* ================= SAFE INSERT ================= */

    const { data, error } = await supabase.rpc("create_booking_safe", {
      p_barber_id: barberId,
      p_service_id: serviceId,
      p_date: date,
      p_start: start_time,
      p_end: end_time,
      p_client_name: client_name.trim(),
      client_phone,
      p_client_email: client_email || null,
    });

    if (error) {
      // slot deja luat (concurență / refresh / retry)
      if (
        error.message.includes("unique_booking_slot") ||
        error.message.includes("SLOT_TAKEN")
      ) {
        return NextResponse.json(
          { error: "Slotul a fost deja rezervat" },
          { status: 409 }
        );
      }

      console.error("CREATE BOOKING RPC ERROR:", error);
      return NextResponse.json(
        { error: "Eroare la creare programare" },
        { status: 500 }
      );
    }

    /* ================= EMAIL CLIENT ================= */

    if (client_email) {
      try {
        await sendEmail({
          to: client_email,
          subject: "Confirmare programare",
          html: clientConfirmationTemplate({
            barberName: data.barber_name,
            date,
            time: `${start_time} – ${end_time}`,
            cancelLink: `${process.env.NEXT_PUBLIC_APP_URL}/cancel/${data.cancel_token}`,
            rescheduleLink: `${process.env.NEXT_PUBLIC_APP_URL}/reschedule/${data.reschedule_token}`,
          }),
        });
      } catch (mailErr) {
        console.error("EMAIL CLIENT ERROR:", mailErr);
        // nu blocăm booking-ul dacă mailul pică
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: data.id,
      cancelToken: data.cancel_token,
    });

  } catch (err) {
    console.error("CREATE BOOKING ERROR:", err);
    return NextResponse.json(
      { error: "Request invalid" },
      { status: 400 }
    );
  }
}

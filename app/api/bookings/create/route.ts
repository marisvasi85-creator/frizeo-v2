import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";

const rateLimitMap = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    /* =========================
       🔒 RATE LIMIT (5 sec / IP)
    ========================= */
    const ip =
      req.headers.get("x-forwarded-for") || "unknown";

    const last = rateLimitMap.get(ip);
    if (last && Date.now() - last < 5000) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429 }
      );
    }

    rateLimitMap.set(ip, Date.now());

    const supabase = await createSupabaseServerClient();
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

    /* 🔍 Validăm service */
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

    /* 🔐 Creare booking prin RPC */
    const { data, error } = await supabase.rpc(
      "create_booking_safe",
      {
        p_barber_id: barberId,
        p_service_id: barberService.service_id,
        p_date: date,
        p_start: start_time,
        p_end: end_time,
        p_client_name: client_name,
        p_client_phone: client_phone,
        p_client_email: client_email || null,
      }
    );

    if (error || !data) {
      return NextResponse.json(
        { error: "Slot indisponibil. Alege alt interval." },
        { status: 400 }
      );
    }

    /* 📧 Email confirmare */
    if (client_email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL!;
      await sendEmail({
        to: client_email,
        subject: "Confirmare programare",
        html: clientConfirmationTemplate({
          barberName: "Frizerul tău",
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
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
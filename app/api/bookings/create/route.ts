import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";
import { barberNewBookingTemplate } from "@/lib/email/templates/barber-new-booking";
import { checkBookingLimit } from "@/lib/billing/checkBookingLimit";

function timeToMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

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

    // =========================
    // 🔥 LUĂM BOOKING ÎNAINTE
    // =========================
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "Slot indisponibil sau expirat" },
        { status: 400 }
      );
    }
    
    // =========================
// 🔥 PLAN LIMIT
// =========================

const limit = await checkBookingLimit(
  booking.tenant_id
);
console.log("BOOKING TENANT:", booking.tenant_id);
console.log("BOOKING LIMIT:", limit);if (!limit.allowed) {
  return NextResponse.json(
    {
      error:
        "Ai atins limita planului Free. Upgrade necesar.",
    },
    { status: 403 }
  );
}
    // =========================
    // 🔥 VALIDARE PAUZĂ (CORECT)
    // =========================
    const [y, m, d] = booking.date.split("-").map(Number);
    const local = new Date(y, m - 1, d);

    const jsDay = local.getDay();
    const day = jsDay === 0 ? 7 : jsDay;

    const { data: schedules } = await supabase
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", booking.barber_id);

    const schedule = schedules?.find(
      (s) => s.day_of_week === day
    );

    if (
      schedule?.break_enabled &&
      schedule.break_start &&
      schedule.break_end
    ) {
      const start = timeToMinutes(booking.start_time);
      const end = timeToMinutes(booking.end_time);

      const bStart = timeToMinutes(schedule.break_start);
      const bEnd = timeToMinutes(schedule.break_end);

      const overlap = start < bEnd && end > bStart;

      if (overlap) {
        return NextResponse.json(
          { error: "Nu poți programa peste pauză" },
          { status: 400 }
        );
      }
    }

    // =========================
    // 🔥 CONFIRMĂ DOAR DUPĂ VALIDARE
    // =========================
    const { data, error } = await supabase
      .from("bookings")
      .update({
        status: "confirmed",
        client_name,
        client_phone,
        client_email: client_email || null,
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Eroare confirmare booking" },
        { status: 400 }
      );
    }

    // =========================
    // 🔥 SERVICE
    // =========================
    const { data: service } = await supabase
      .from("barber_services")
      .select("display_name, name")
      .eq("id", data.barber_service_id)
      .single();

    const serviceName =
      service?.display_name || service?.name || "Serviciu";

    // =========================
    // 🔥 BARBER
    // =========================
    let barberEmail: string | null = null;
    let barberName = "Barber";

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

    // =========================
    // 🔥 FORMAT
    // =========================
    const formattedDate = new Date(data.date).toLocaleDateString("ro-RO");
    const formattedTime = data.start_time?.slice(0, 5);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const cancelUrl = `${baseUrl}/cancel/${data.cancel_token}`;
    const rescheduleUrl = `${baseUrl}/reschedule/${data.reschedule_token}`;

    // =========================
    // 📩 EMAIL CLIENT
    // =========================
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

    // =========================
    // 📩 EMAIL BARBER
    // =========================
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
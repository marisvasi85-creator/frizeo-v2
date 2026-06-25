import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";
import { barberNewBookingTemplate } from "@/lib/email/templates/barber-new-booking";
import { checkBookingLimit } from "@/lib/billing/checkBookingLimit";
import { createGoogleEvent } from "@/lib/google/createEvent";
import { refreshAccessToken } from "@/lib/google/refreshAccessToken";
import { sendSms } from "@/lib/sms/sendSms";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";
import { smsAllowedForTenant } from "@/lib/billing/smsAllowedForTenant";
import {
  jsDayToScheduleDay,
  timesOverlap,
} from "@/lib/schedule/time";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin;
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

const settings =
  await getNotificationSettings(
    booking.tenant_id
  );

const smsAllowed = await smsAllowedForTenant(booking.tenant_id);

if (!limit.allowed) {
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
    const day = jsDayToScheduleDay(booking.date);

    const { data: schedule } = await supabase
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", booking.barber_id)
      .eq("day_of_week", day)
      .maybeSingle();

    const { data: override } = await supabase
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", booking.barber_id)
      .eq("date", booking.date)
      .maybeSingle();

    const resolved = resolveDaySchedule(schedule, override);

    if (!resolved.isWorking) {
      return NextResponse.json(
        { error: "Ziua selectată nu este disponibilă" },
        { status: 400 }
      );
    }

    if (
      resolved.breakEnabled &&
      resolved.breakStart &&
      resolved.breakEnd
    ) {
      const overlap = timesOverlap(
        booking.start_time,
        booking.end_time,
        resolved.breakStart,
        resolved.breakEnd
      );

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
// 📅 GOOGLE CALENDAR
// =========================

try {

  const { data: googleAccount } = await supabase
    .from("barber_google_accounts")
    .select("*")
    .eq("barber_id", data.barber_id)
    .single();

  if (googleAccount?.access_token) {

  let accessToken =
    googleAccount.access_token;

  const expiresAt = new Date(
    googleAccount.expires_at
  );

  const now = new Date();

  const shouldRefresh =
    expiresAt.getTime() <
    now.getTime() + 5 * 60 * 1000;

  if (
    shouldRefresh &&
    googleAccount.refresh_token
  ) {

    const refreshed =
      await refreshAccessToken(
        googleAccount.refresh_token
      );

    if (refreshed?.access_token) {

      accessToken =
        refreshed.access_token;

      await supabase
        .from("barber_google_accounts")
        .update({
          access_token:
            refreshed.access_token,

          expires_at: new Date(
            Date.now() +
              refreshed.expires_in * 1000
          ).toISOString(),
        })
        .eq(
          "barber_id",
          data.barber_id
        );
    }
  }

  const startDateTime =
    `${data.date}T${data.start_time}`;

    const endDateTime =
      `${data.date}T${data.end_time}`;

    const event = await createGoogleEvent({
  accessToken: accessToken,
  calendarId:
    googleAccount.calendar_id || "primary",

  title:
    `${client_name} | ${client_phone} | ${serviceName}`,

  description:
`Client: ${client_name}
Telefon: ${client_phone}
Serviciu: ${serviceName}`,

  start: startDateTime,
  end: endDateTime,
});

    if (event?.id) {

      await supabase
        .from("bookings")
        .update({
          google_event_id: event.id,
        })
        .eq("id", data.id);
    }
  }

} catch (e) {

  console.error(
    "GOOGLE CALENDAR ERROR:",
    e
  );

}

    // =========================
    // 📩 EMAIL CLIENT
    // =========================
    if (
  client_email &&
  settings?.booking_email_enabled
) {
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
// 📱 SMS CLIENT
// =========================

if (
  client_phone &&
  settings?.booking_sms_enabled &&
  smsAllowed
) {

try {

  await sendSms({
    phone: client_phone,

    message:
`Frizeo

Programarea ta este confirmata.

${formattedDate}
${formattedTime}

${serviceName}`,
  });

} catch (e) {

  console.error(
    "SMS CLIENT ERROR:",
    e
  );

}
}
    // =========================
    // 📩 EMAIL BARBER
    // =========================
    if (
  barberEmail &&
  settings?.booking_email_enabled
) {
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
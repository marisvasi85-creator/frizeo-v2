import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";
import { barberNewBookingTemplate } from "@/lib/email/templates/barber-new-booking";
import { checkBookingLimit } from "@/lib/billing/checkBookingLimit";
import { syncBookingToGoogleCalendar } from "@/lib/google/syncBookingEvent";
import { sendSms } from "@/lib/sms/sendSms";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";
import { extendedSmsAllowedForTenant } from "@/lib/billing/smsAllowedForTenant";
import {
  jsDayToScheduleDay,
  timesOverlap,
} from "@/lib/schedule/time";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import { requireActiveBarberForNewBooking } from "@/lib/barbers/requireActiveBarberForBooking";
import { bookingClientUrls } from "@/lib/bookings/bookingClientUrls";
import { ensureBookingClientTokens } from "@/lib/bookings/ensureBookingClientTokens";
import { buildClientCalendarLinks } from "@/lib/calendar/buildClientCalendarLinks";
import { fetchResolvedBarberLocation } from "@/lib/location/fetchResolvedBarberLocation";
import { confirmPendingHold } from "@/lib/bookings/confirmPendingHold";
import {
  requireManagedBarber,
} from "@/lib/barber-access/authorization";
import { assertBookingLeadTimeForBarber } from "@/lib/bookings/bookingLeadTime";
import {
  checkBarberBookingAccess,
  isMissingBarberAccessSchema,
  publicAccessMessage,
} from "@/lib/barber-access/server";

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin;
    const body = await req.json();

    const {
      bookingId,
      client_name,
      client_phone,
      client_email,
      client_notes,
      booking_context,
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

    const barberCheck = await requireActiveBarberForNewBooking(
      booking.barber_id
    );

    if (!barberCheck.ok) {
      return NextResponse.json(
        { error: barberCheck.error },
        { status: barberCheck.status }
      );
    }

    let bypassMinNotice = false;
    let isDashboardBooking = false;
    let dashboardActorId: string | null = null;
    const dashboardContext = booking_context === "dashboard"
      ? await requireManagedBarber(booking.barber_id)
      : null;

    if (dashboardContext instanceof NextResponse) return dashboardContext;

    if (dashboardContext) {
      bypassMinNotice = true;
      isDashboardBooking = true;
      dashboardActorId = dashboardContext.auth.user.id;
    }

    if (!isDashboardBooking) {
      const bookingAccess = await checkBarberBookingAccess({
        barberId: booking.barber_id,
        phone: client_phone,
      });

      if (!bookingAccess.canBook) {
        return NextResponse.json(
          {
            error: publicAccessMessage(bookingAccess),
            accessStatus: bookingAccess.status,
          },
          { status: 403 },
        );
      }
    }

    const leadTime = await assertBookingLeadTimeForBarber(
      supabase,
      booking.barber_id,
      booking.date,
      booking.start_time,
      { bypassMinNotice },
    );

    if (!leadTime.ok) {
      return NextResponse.json({ error: leadTime.error }, { status: 400 });
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

const smsAllowed = await extendedSmsAllowedForTenant(booking.tenant_id);

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

    const [{ data: schedule }, { data: override }, { data: barberRow }] =
      await Promise.all([
        supabase
          .from("barber_weekly_schedule")
          .select("*")
          .eq("barber_id", booking.barber_id)
          .eq("day_of_week", day)
          .maybeSingle(),
        supabase
          .from("barber_day_overrides")
          .select("*")
          .eq("barber_id", booking.barber_id)
          .eq("date", booking.date)
          .maybeSingle(),
        supabase
          .from("barbers")
          .select("schedule_mode")
          .eq("id", booking.barber_id)
          .maybeSingle(),
      ]);

    const scheduleMode =
      barberRow?.schedule_mode === "selective" ? "selective" : "weekly";
    const resolved = resolveDaySchedule(schedule, override, scheduleMode);

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

    const notes = normalizeClientNotes(client_notes);

    // =========================
    // 🔥 CONFIRMĂ DOAR DUPĂ VALIDARE (atomic: un singur winner trimite notificări)
    // =========================
    let data: typeof booking = null;
    let error: { code?: string | null; message?: string | null } | null = null;
    let didConfirm = false;

    if (isDashboardBooking) {
      const manualResult = await supabase.rpc("confirm_manual_booking_access", {
        p_booking_id: bookingId,
        p_client_name: client_name,
        p_client_phone: client_phone,
        p_client_email: client_email || null,
        p_client_notes: notes,
        p_actor: dashboardActorId,
      });

      data = Array.isArray(manualResult.data)
        ? manualResult.data[0]
        : manualResult.data;
      error = manualResult.error;

      // Safe deployment order: before the additive migration reaches the
      // shared database, dashboard bookings keep their legacy open behavior.
      if (error && isMissingBarberAccessSchema(error)) {
        const fallback = await confirmPendingHold(supabase, {
          bookingId,
          client_name,
          client_phone,
          client_email,
          client_notes: notes,
        });
        if (fallback.ok) {
          data = fallback.booking as typeof booking;
          error = null;
          didConfirm = fallback.didConfirm;
        } else {
          data = null;
          error = fallback.error as typeof error;
        }
      } else if (data) {
        didConfirm = true;
      } else {
        const { data: existing } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", bookingId)
          .eq("status", "confirmed")
          .maybeSingle();
        if (existing) {
          data = existing;
          error = null;
          didConfirm = false;
        }
      }
    } else {
      const publicResult = await confirmPendingHold(supabase, {
        bookingId,
        client_name,
        client_phone,
        client_email,
        client_notes: notes,
      });

      if (publicResult.ok) {
        data = publicResult.booking as typeof booking;
        didConfirm = publicResult.didConfirm;
        error = null;
      } else {
        data = null;
        error = publicResult.error as typeof error;
      }
    }

    if (error && !isDashboardBooking) {
      const latestAccess = await checkBarberBookingAccess({
        barberId: booking.barber_id,
        phone: client_phone,
      });
      if (!latestAccess.canBook) {
        return NextResponse.json(
          {
            error: publicAccessMessage(latestAccess),
            accessStatus: latestAccess.status,
          },
          { status: 403 },
        );
      }
    }

    if (error || !data) {
      return NextResponse.json(
        { error: "Eroare confirmare booking" },
        { status: 400 }
      );
    }

    const replayTokens = await ensureBookingClientTokens(data.id);

    // A concurrent retry already confirmed this hold — return success
    // without sending a second email, SMS, or Google Calendar event.
    if (!didConfirm) {
      return NextResponse.json({
        success: true,
        bookingId: data.id,
        cancelToken: replayTokens?.cancel_token ?? data.cancel_token ?? null,
      });
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

    const bookingLocation = await fetchResolvedBarberLocation(
      data.barber_id,
      data.tenant_id,
    );

    // =========================
    // 🔥 FORMAT
    // =========================
    const formattedDate = new Date(data.date).toLocaleDateString("ro-RO");
    const formattedTime = data.start_time?.slice(0, 5);

    const tokens = replayTokens;
    const bookingForUrls = {
      ...data,
      cancel_token: tokens?.cancel_token ?? data.cancel_token,
      reschedule_token: tokens?.reschedule_token ?? data.reschedule_token,
    };
    const { cancelUrl, rescheduleUrl } = bookingClientUrls(bookingForUrls);

    const calendarLinks =
      tokens?.cancel_token && data.end_time
        ? buildClientCalendarLinks({
            bookingId: data.id,
            serviceName,
            barberName,
            date: data.date,
            startTime: data.start_time,
            endTime: data.end_time,
            cancelToken: tokens.cancel_token,
            locationAddress: bookingLocation?.formattedAddress,
            notes,
            cancelUrl,
            rescheduleUrl,
          })
        : null;

// =========================
// 📅 GOOGLE CALENDAR
// =========================

try {
  await syncBookingToGoogleCalendar(supabase, data, {
    clientName: client_name,
    clientPhone: client_phone,
    serviceName,
    notes,
  });
} catch (e) {
  console.error("GOOGLE CALENDAR ERROR:", e);
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
            location: bookingLocation,
            notes,
            googleCalendarUrl: calendarLinks?.googleUrl,
            icsUrl: calendarLinks?.icsUrl,
          }),
          icsContent: calendarLinks?.icsContent,
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

${serviceName}${bookingLocation?.formattedAddress ? `\n\n${bookingLocation.formattedAddress}` : ""}`,
    meta: {
      tenantId: data.tenant_id,
      bookingId: data.id,
      barberId: data.barber_id,
      smsType: "booking",
    },
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
            notes,
          }),
        });
      } catch (e) {
        console.error("BARBER EMAIL ERROR:", e);
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: data.id,
      cancelToken: tokens?.cancel_token ?? data.cancel_token ?? null,
    });

  } catch (err) {
    console.error("CREATE ERROR:", err);

    return NextResponse.json(
      { error: "Eroare server" },
      { status: 500 }
    );
  }
}

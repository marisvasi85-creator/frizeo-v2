import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/email";
import { rescheduleConfirmationTemplate } from "@/lib/email/templates/reschedule-confirmation";
import { deleteGoogleEvent } from "@/lib/google/deleteEvent";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";
import { syncBookingToGoogleCalendar } from "@/lib/google/syncBookingEvent";
import { sendSms } from "@/lib/sms/sendSms";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";
import { extendedSmsAllowedForTenant } from "@/lib/billing/smsAllowedForTenant";
import { bookingClientUrls } from "@/lib/bookings/bookingClientUrls";
import { ensureBookingClientTokens } from "@/lib/bookings/ensureBookingClientTokens";
import { buildClientCalendarLinks } from "@/lib/calendar/buildClientCalendarLinks";
import { fetchResolvedBarberLocation } from "@/lib/location/fetchResolvedBarberLocation";
import { normalizeClientNotes } from "@/lib/bookings/normalizeClientNotes";
import {
  barberBelongsToTenant,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { assertBookingLeadTimeForBarber } from "@/lib/bookings/bookingLeadTime";
import { addMinutesToTime } from "@/lib/schedule/time";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: Request) {
  try {
    const limited = await enforceRateLimit(req, {
      bucket: "booking-reschedule",
      limit: 15,
      windowSeconds: 600,
    });
    if (limited) return limited;

    const supabase = supabaseAdmin;
    const body = await req.json();

    const {
      token,
      new_date,
      new_start_time,

      // 🔥 ADAUGAT (din edit modal)
      client_name,
      client_phone,
      client_email,
      client_notes,
    } = body;

    if (!token || !new_date || !new_start_time) {
      return NextResponse.json(
        { error: "Date invalide" },
        { status: 400 }
      );
    }

    // 🔥 GET BOOKING EXISTENT
    const { data: oldBooking, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("reschedule_token", token)
      .eq("status", "confirmed")
      .single();

    if (error || !oldBooking) {
      return NextResponse.json(
        { error: "Link invalid sau expirat" },
        { status: 404 }
      );
    }

    // 🔥 NU PERMITEM ACEEAȘI ORĂ
    if (
      oldBooking.date === new_date &&
      oldBooking.start_time === new_start_time
    ) {
      return NextResponse.json(
        { error: "Ai selectat aceeași oră" },
        { status: 400 }
      );
    }

    // 🔥 BLOCK 2H
    const bookingTime = new Date(
      `${oldBooking.date}T${oldBooking.start_time}`
    );

    if (bookingTime <= new Date(Date.now() + 2 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: "Nu mai poate fi reprogramată" },
        { status: 403 }
      );
    }

    // 🔥 SERVICE CORECT
    let barberServiceId = oldBooking.barber_service_id;

    if (!barberServiceId && oldBooking.service_id) {
      const { data: bs } = await supabase
        .from("barber_services")
        .select("id")
        .eq("service_id", oldBooking.service_id)
        .eq("barber_id", oldBooking.barber_id)
        .single();

      barberServiceId = bs?.id;
    }

    if (!barberServiceId) {
      return NextResponse.json(
        { error: "Serviciu invalid" },
        { status: 400 }
      );
    }

    const { data: selectedService } = await supabase
      .from("barber_services")
      .select("duration")
      .eq("id", barberServiceId)
      .eq("barber_id", oldBooking.barber_id)
      .eq("tenant_id", oldBooking.tenant_id)
      .single();

    if (!selectedService?.duration) {
      return NextResponse.json(
        { error: "Serviciu invalid" },
        { status: 400 },
      );
    }

    const calculatedEndTime = addMinutesToTime(
      new_start_time,
      selectedService.duration,
    );

    let bypassMinNotice = false;
    const auth = await requireTenantAccess(["owner", "manager", "barber"]);

    if (!isAuthError(auth)) {
      const belongs = await barberBelongsToTenant(
        supabase,
        oldBooking.barber_id,
        auth.tenantId,
      );

      if (belongs) {
        bypassMinNotice = true;
      }
    }

    const leadTime = await assertBookingLeadTimeForBarber(
      supabase,
      oldBooking.barber_id,
      new_date,
      new_start_time,
      { bypassMinNotice },
    );

    if (!leadTime.ok) {
      return NextResponse.json({ error: leadTime.error }, { status: 400 });
    }

    // 🔥 FOLOSIM DATELE NOI SAU FALLBACK
    const finalName = client_name ?? oldBooking.client_name;
    const finalPhone = client_phone ?? oldBooking.client_phone;
    const finalEmail = client_email ?? oldBooking.client_email;
    const finalNotes =
      client_notes !== undefined
        ? normalizeClientNotes(client_notes)
        : oldBooking.client_notes ?? null;
    const settings =
  await getNotificationSettings(
    oldBooking.tenant_id
  );
    const smsAllowed = await extendedSmsAllowedForTenant(oldBooking.tenant_id);
    // Atomic create + cancel (DB transaction) — avoids double booking on crash mid-flow.
    const { data: newBooking, error: rpcError } =
      await supabase.rpc("reschedule_booking_safe", {
        p_old_booking_id: oldBooking.id,
        p_date: new_date,
        p_start: new_start_time,
        p_client_name: finalName,
        p_client_phone: finalPhone,
        p_client_email: finalEmail,
        p_client_notes: finalNotes,
        p_barber_service_id: barberServiceId,
      });

    if (rpcError || !newBooking) {
  console.error("RPC ERROR:", rpcError);

  return NextResponse.json(
    {
      error:
        rpcError?.message ||
        "Slot ocupat",
    },
    { status: 400 }
  );
}

    // 🔥 EMAIL BARBER
    let barberEmail: string | null = null;
    let barberName = "Frizer";

    try {
      const { data: barber } = await supabase
        .from("barbers")
        .select("user_id, display_name")
        .eq("id", oldBooking.barber_id)
        .single();

      barberName = barber?.display_name || barberName;

      if (barber?.user_id) {
        const { data: userData } =
          await supabase.auth.admin.getUserById(barber.user_id);

        barberEmail = userData?.user?.email || null;
      }
    } catch (e) {
      console.error("BARBER ERROR:", e);
    }

    const bookingLocation = await fetchResolvedBarberLocation(
      oldBooking.barber_id,
      oldBooking.tenant_id,
    );

    if (barberEmail) {
      await sendEmail({
        to: barberEmail,
        subject: "Programare reprogramată",
        html: `Programare modificată:
        ${new_date} ${new_start_time}`,
      });
    }

    // 🔥 GOOGLE CALENDAR RESCHEDULE
    let serviceName = "Serviciu";

    try {
      const { data: service } = await supabase
        .from("barber_services")
        .select("display_name,name")
        .eq("id", newBooking.barber_service_id)
        .single();

      serviceName =
        service?.display_name || service?.name || "Serviciu";

      if (oldBooking.google_event_id) {
        const tokens = await getAccessTokenForBarber(
          supabase,
          oldBooking.barber_id,
        );

        if (tokens) {
          await deleteGoogleEvent({
            accessToken: tokens.accessToken,
            calendarId: tokens.calendarId,
            eventId: oldBooking.google_event_id,
          });
        }
      }

      await syncBookingToGoogleCalendar(supabase, newBooking, {
        clientName: finalName,
        clientPhone: finalPhone,
        serviceName,
        notes: finalNotes,
      });
    } catch (e) {
      console.error("GOOGLE RESCHEDULE ERROR:", e);
    }

    // Old booking already cancelled atomically inside reschedule_booking_safe.

    const bookingWithTokens = await ensureBookingClientTokens(newBooking.id);

    if (!bookingWithTokens?.cancel_token || !bookingWithTokens?.reschedule_token) {
      return NextResponse.json(
        { error: "Nu s-au putut genera link-urile pentru client" },
        { status: 500 }
      );
    }

    const { cancelUrl, rescheduleUrl } = bookingClientUrls(bookingWithTokens);
    const formattedDate = new Date(new_date).toLocaleDateString("ro-RO");

    const calendarLinks = buildClientCalendarLinks({
      bookingId: newBooking.id,
      serviceName,
      barberName,
      date: new_date,
      startTime: new_start_time,
      endTime: calculatedEndTime,
      cancelToken: bookingWithTokens.cancel_token,
      locationAddress: bookingLocation?.formattedAddress,
      notes: finalNotes,
      cancelUrl,
      rescheduleUrl,
    });

    // 🔥 EMAIL CLIENT
    if (
  finalEmail &&
  settings?.reschedule_email_enabled
) {
      try {
        const html = rescheduleConfirmationTemplate({
          barberName,
          date: formattedDate,
          time: new_start_time,
          cancelUrl,
          rescheduleUrl,
          location: bookingLocation,
          googleCalendarUrl: calendarLinks.googleUrl,
          icsUrl: calendarLinks.icsUrl,
        });

        await sendEmail({
          to: finalEmail,
          subject: "Programare reprogramată",
          html,
          icsContent: calendarLinks.icsContent,
        });

      } catch (e) {
        console.error("EMAIL ERROR:", e);
      }
    }


    // 🔥 SMS CLIENT

if (
  finalPhone &&
  settings?.reschedule_sms_enabled &&
  smsAllowed
) {

  try {

    await sendSms({
      phone: finalPhone,

      message:
`Frizeo

Programarea ta a fost reprogramata.

${new_date}
${new_start_time}`,
      meta: {
        tenantId: oldBooking.tenant_id,
        bookingId: newBooking.id,
        barberId: oldBooking.barber_id,
        smsType: "reschedule",
      },
    });

  } catch (e) {

    console.error(
      "RESCHEDULE SMS ERROR:",
      e
    );

  }

}

    return NextResponse.json({
      success: true,
      bookingId: newBooking.id,
      cancelToken: bookingWithTokens?.cancel_token ?? null,
    });

  } catch (err) {
    console.error("RESCHEDULE ERROR:", err);

    return NextResponse.json(
      { error: "Eroare internă (rescheduling)" },
      { status: 500 }
    );
  }
}

import { bookingClientUrls } from "@/lib/bookings/bookingClientUrls";
import { ensureBookingClientTokens } from "@/lib/bookings/ensureBookingClientTokens";
import { buildClientCalendarLinks } from "@/lib/calendar/buildClientCalendarLinks";
import { sendEmail } from "@/lib/email/email";
import { cancelBookingTemplate } from "@/lib/email/templates/cancel-booking";
import { rescheduleConfirmationTemplate } from "@/lib/email/templates/reschedule-confirmation";
import { deleteGoogleEvent } from "@/lib/google/deleteEvent";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";
import { syncBookingToGoogleCalendar } from "@/lib/google/syncBookingEvent";
import { fetchResolvedBarberLocation } from "@/lib/location/fetchResolvedBarberLocation";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";
import { extendedSmsAllowedForTenant } from "@/lib/billing/smsAllowedForTenant";
import { sendSms } from "@/lib/sms/sendSms";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function deleteBookingGoogleEvent(input: {
  barberId: string;
  googleEventId: string | null | undefined;
}) {
  if (!input.googleEventId) return;
  try {
    const google = await getAccessTokenForBarber(supabaseAdmin, input.barberId);
    if (!google) return;
    await deleteGoogleEvent({
      accessToken: google.accessToken,
      calendarId: google.calendarId,
      eventId: input.googleEventId,
    });
  } catch (err) {
    console.error("assistant google delete:", err);
  }
}

export async function notifyBookingCancelled(input: {
  booking: {
    id: string;
    tenant_id: string;
    barber_id: string;
    date: string;
    start_time: string;
    end_time: string;
    client_name: string;
    client_phone: string | null;
    client_email: string | null;
  };
}) {
  const settings = await getNotificationSettings(input.booking.tenant_id);
  const smsAllowed = await extendedSmsAllowedForTenant(input.booking.tenant_id);
  const time = `${String(input.booking.start_time).slice(0, 5)} - ${String(input.booking.end_time).slice(0, 5)}`;

  if (input.booking.client_email && settings?.cancel_email_enabled) {
    try {
      await sendEmail({
        to: input.booking.client_email,
        subject: "Programare anulată",
        html: cancelBookingTemplate({
          clientName: input.booking.client_name,
          date: input.booking.date,
          time,
        }),
      });
    } catch (err) {
      console.error("assistant cancel email:", err);
    }
  }

  if (
    input.booking.client_phone &&
    settings?.cancel_sms_enabled &&
    smsAllowed
  ) {
    try {
      await sendSms({
        phone: input.booking.client_phone,
        message: `Frizeo

Programarea ta din
${input.booking.date}
${String(input.booking.start_time).slice(0, 5)}

a fost anulata.`,
        meta: {
          tenantId: input.booking.tenant_id,
          bookingId: input.booking.id,
          barberId: input.booking.barber_id,
          smsType: "cancel",
        },
      });
    } catch (err) {
      console.error("assistant cancel sms:", err);
    }
  }
}

export async function syncAndNotifyBookingRescheduled(input: {
  booking: {
    id: string;
    tenant_id: string;
    barber_id: string;
    date: string;
    start_time: string;
    end_time: string;
    client_name: string;
    client_phone: string | null;
    client_email: string | null;
    client_notes: string | null;
    google_event_id?: string | null;
  };
  previousGoogleEventId?: string | null;
  serviceName: string;
}) {
  await deleteBookingGoogleEvent({
    barberId: input.booking.barber_id,
    googleEventId: input.previousGoogleEventId ?? input.booking.google_event_id,
  });

  try {
    await syncBookingToGoogleCalendar(supabaseAdmin, input.booking, {
      clientName: input.booking.client_name,
      clientPhone: input.booking.client_phone || "",
      serviceName: input.serviceName,
      notes: input.booking.client_notes,
    });
  } catch (err) {
    console.error("assistant reschedule google:", err);
  }

  const settings = await getNotificationSettings(input.booking.tenant_id);
  const smsAllowed = await extendedSmsAllowedForTenant(input.booking.tenant_id);

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("display_name")
    .eq("id", input.booking.barber_id)
    .maybeSingle();
  const barberName = barber?.display_name || "Barber";

  const tokens = await ensureBookingClientTokens(input.booking.id);
  if (!tokens?.cancel_token || !tokens?.reschedule_token) return;

  const bookingForUrls = {
    ...input.booking,
    cancel_token: tokens.cancel_token,
    reschedule_token: tokens.reschedule_token,
  };
  const { cancelUrl, rescheduleUrl } = bookingClientUrls(bookingForUrls);
  const bookingLocation = await fetchResolvedBarberLocation(
    input.booking.barber_id,
    input.booking.tenant_id,
  );
  const formattedDate = new Date(input.booking.date).toLocaleDateString("ro-RO");
  const formattedTime = String(input.booking.start_time).slice(0, 5);

  const calendarLinks = buildClientCalendarLinks({
    bookingId: input.booking.id,
    serviceName: input.serviceName,
    barberName,
    date: input.booking.date,
    startTime: input.booking.start_time,
    endTime: input.booking.end_time,
    cancelToken: tokens.cancel_token,
    locationAddress: bookingLocation?.formattedAddress,
    notes: input.booking.client_notes,
    cancelUrl,
    rescheduleUrl,
  });

  if (input.booking.client_email && settings?.reschedule_email_enabled) {
    try {
      await sendEmail({
        to: input.booking.client_email,
        subject: "Programare reprogramată",
        html: rescheduleConfirmationTemplate({
          barberName,
          date: formattedDate,
          time: formattedTime,
          cancelUrl,
          rescheduleUrl,
          location: bookingLocation,
          googleCalendarUrl: calendarLinks.googleUrl,
          icsUrl: calendarLinks.icsUrl,
        }),
        icsContent: calendarLinks.icsContent,
      });
    } catch (err) {
      console.error("assistant reschedule email:", err);
    }
  }

  if (
    input.booking.client_phone &&
    settings?.reschedule_sms_enabled &&
    smsAllowed
  ) {
    try {
      await sendSms({
        phone: input.booking.client_phone,
        message: `Frizeo

Programarea ta a fost reprogramata.

${input.booking.date}
${formattedTime}`,
        meta: {
          tenantId: input.booking.tenant_id,
          bookingId: input.booking.id,
          barberId: input.booking.barber_id,
          smsType: "reschedule",
        },
      });
    } catch (err) {
      console.error("assistant reschedule sms:", err);
    }
  }
}

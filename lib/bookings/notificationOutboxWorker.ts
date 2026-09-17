import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/email";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";
import { barberNewBookingTemplate } from "@/lib/email/templates/barber-new-booking";
import { syncBookingToGoogleCalendar } from "@/lib/google/syncBookingEvent";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";
import { sendSms } from "@/lib/sms/sendSms";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";
import { extendedSmsAllowedForTenant } from "@/lib/billing/smsAllowedForTenant";
import { bookingClientUrls } from "@/lib/bookings/bookingClientUrls";
import { ensureBookingClientTokens } from "@/lib/bookings/ensureBookingClientTokens";
import { buildClientCalendarLinks } from "@/lib/calendar/buildClientCalendarLinks";
import { fetchResolvedBarberLocation } from "@/lib/location/fetchResolvedBarberLocation";

type Channel =
  | "google_calendar"
  | "client_email"
  | "client_sms"
  | "barber_email";

type OutboxJob = {
  id: string;
  booking_id: string;
  channel: Channel;
  attempt_count: number;
  claim_token: string;
};

const MAX_ATTEMPTS = 5;
const RETRY_SECONDS = [30, 60, 5 * 60, 15 * 60, 60 * 60] as const;

function retryAt(attemptCount: number): string {
  const seconds = RETRY_SECONDS[
    Math.min(Math.max(attemptCount - 1, 0), RETRY_SECONDS.length - 1)
  ];
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown_error";
  return message.slice(0, 500);
}

async function completeJob(job: OutboxJob) {
  await supabaseAdmin
    .from("booking_notification_outbox")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      claimed_at: null,
      claim_token: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("claim_token", job.claim_token);
}

async function failJob(job: OutboxJob, error: unknown) {
  const terminal = job.attempt_count >= MAX_ATTEMPTS;
  await supabaseAdmin
    .from("booking_notification_outbox")
    .update({
      status: terminal ? "failed" : "pending",
      available_at: terminal ? new Date().toISOString() : retryAt(job.attempt_count),
      claimed_at: null,
      claim_token: null,
      last_error: safeError(error),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("claim_token", job.claim_token);
}

async function deliverJob(job: OutboxJob): Promise<"sent" | "skipped"> {
  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", job.booking_id)
    .maybeSingle();

  // A cancellation can race the worker. Never send a stale confirmation or
  // create a calendar event after the booking stopped being confirmed.
  if (!booking || booking.status !== "confirmed") return "skipped";

  const [{ data: service }, { data: barber }, settings, smsAllowed, location] =
    await Promise.all([
      supabaseAdmin
        .from("barber_services")
        .select("display_name, name")
        .eq("id", booking.barber_service_id)
        .maybeSingle(),
      supabaseAdmin
        .from("barbers")
        .select("user_id, display_name")
        .eq("id", booking.barber_id)
        .maybeSingle(),
      getNotificationSettings(booking.tenant_id),
      extendedSmsAllowedForTenant(booking.tenant_id),
      fetchResolvedBarberLocation(booking.barber_id, booking.tenant_id),
    ]);

  const serviceName = service?.display_name || service?.name || "Serviciu";
  const barberName = barber?.display_name || "Barber";
  const formattedDate = new Date(booking.date).toLocaleDateString("ro-RO");
  const formattedTime = booking.start_time?.slice(0, 5);

  if (job.channel === "google_calendar") {
    if (booking.google_event_id) return "skipped";
    const googleTokens = await getAccessTokenForBarber(
      supabaseAdmin,
      booking.barber_id,
    );
    if (!googleTokens) return "skipped";
    const eventId = await syncBookingToGoogleCalendar(supabaseAdmin, booking, {
      clientName: booking.client_name,
      clientPhone: booking.client_phone,
      serviceName,
      notes: booking.client_notes,
    });
    if (!eventId) throw new Error("google_calendar_sync_failed");
    return "sent";
  }

  if (job.channel === "client_sms") {
    if (!booking.client_phone || !settings?.booking_sms_enabled || !smsAllowed) {
      return "skipped";
    }
    const result = await sendSms({
      phone: booking.client_phone,
      message: `Frizeo\n\nProgramarea ta este confirmata.\n\n${formattedDate}\n${formattedTime}\n\n${serviceName}${location?.formattedAddress ? `\n\n${location.formattedAddress}` : ""}`,
      meta: {
        tenantId: booking.tenant_id,
        bookingId: booking.id,
        barberId: booking.barber_id,
        smsType: "booking",
      },
    });
    if (!result.ok) throw new Error("booking_sms_failed");
    return "sent";
  }

  if (!settings?.booking_email_enabled) return "skipped";

  if (job.channel === "barber_email") {
    if (!barber?.user_id) return "skipped";
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
      barber.user_id,
    );
    const barberEmail = userData?.user?.email;
    if (!barberEmail) return "skipped";
    await sendEmail({
      to: barberEmail,
      subject: "Programare nouă",
      html: barberNewBookingTemplate({
        clientName: booking.client_name,
        phone: booking.client_phone,
        serviceName,
        date: formattedDate,
        time: formattedTime,
        notes: booking.client_notes,
      }),
    });
    return "sent";
  }

  if (!booking.client_email) return "skipped";
  const tokens = await ensureBookingClientTokens(booking.id);
  if (!tokens?.cancel_token) throw new Error("booking_tokens_missing");
  const bookingForUrls = { ...booking, ...tokens };
  const { cancelUrl, rescheduleUrl } = bookingClientUrls(bookingForUrls);
  const links = buildClientCalendarLinks({
    bookingId: booking.id,
    serviceName,
    barberName,
    date: booking.date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    cancelToken: tokens.cancel_token,
    locationAddress: location?.formattedAddress,
    notes: booking.client_notes,
    cancelUrl,
    rescheduleUrl,
  });
  await sendEmail({
    to: booking.client_email,
    subject: "Programare confirmată",
    html: clientConfirmationTemplate({
      clientName: booking.client_name,
      barberName,
      serviceName,
      date: formattedDate,
      time: formattedTime,
      cancelUrl,
      rescheduleUrl,
      location,
      notes: booking.client_notes,
      googleCalendarUrl: links.googleUrl,
      icsUrl: links.icsUrl,
    }),
    icsContent: links.icsContent,
  });
  return "sent";
}

export type BookingNotificationWorkerResult = {
  claimed: number;
  sent: number;
  skipped: number;
  retried: number;
  failed: number;
};

export async function processBookingNotificationBatch(input?: {
  bookingId?: string;
  limit?: number;
}): Promise<BookingNotificationWorkerResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_booking_notification_jobs",
    {
      p_limit: input?.limit ?? 8,
      p_lease_seconds: 5 * 60,
      p_booking_id: input?.bookingId ?? null,
    },
  );
  if (error) throw error;

  const jobs = (data || []) as OutboxJob[];
  const result: BookingNotificationWorkerResult = {
    claimed: jobs.length,
    sent: 0,
    skipped: 0,
    retried: 0,
    failed: 0,
  };

  await Promise.all(
    jobs.map(async (job) => {
      try {
        const outcome = await deliverJob(job);
        await completeJob(job);
        result[outcome] += 1;
      } catch (error) {
        await failJob(job, error);
        if (job.attempt_count >= MAX_ATTEMPTS) result.failed += 1;
        else result.retried += 1;
        console.error("[booking-notification-worker] delivery failed", {
          bookingId: job.booking_id,
          channel: job.channel,
          attempt: job.attempt_count,
          error: safeError(error),
        });
      }
    }),
  );

  return result;
}

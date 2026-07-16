import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/email";
import { sendSms } from "@/lib/sms/sendSms";
import { smsAllowedForTenant } from "@/lib/billing/smsAllowedForTenant";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";
import { isAuthorizedCron } from "@/lib/cron/isAuthorizedCron";
import { bookingClientUrls } from "@/lib/bookings/bookingClientUrls";
import { ensureBookingClientTokens } from "@/lib/bookings/ensureBookingClientTokens";
import { reminderEmailTemplate } from "@/lib/email/templates/reminder-email";
import { fetchResolvedBarberLocation } from "@/lib/location/fetchResolvedBarberLocation";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
  parseBookingDateTime,
} from "@/lib/bookings/bookingTimezone";

const CRON_INTERVAL_MS = 15 * 60 * 1000;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000 + CRON_INTERVAL_MS);

    const today = getTodayInBookingTimezone(now);
    const tomorrow = addDaysToDateString(today, 1);

    await supabaseAdmin
      .from("bookings")
      .delete()
      .eq("status", "pending")
      .lt("expires_at", now.toISOString());

    const { data: bookings, error } =
      await supabaseAdmin
        .from("bookings")
        .select(`
          id,
          tenant_id,
          barber_id,
          client_email,
          client_phone,
          date,
          start_time,
          cancel_token,
          reschedule_token,
          reminder_2h_sent
        `)
        .eq("status", "confirmed")
        .eq("reminder_2h_sent", false)
        .in("date", [today, tomorrow]);

    if (error) {
      console.error(
        "FETCH ERROR:",
        error
      );

      return NextResponse.json(
        {
          error: "Fetch failed",
        },
        {
          status: 500,
        }
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let candidateCount = 0;

    for (const b of bookings || []) {
      const bookingTime = parseBookingDateTime(b.date, b.start_time);

      if (bookingTime <= now || bookingTime > in2h) {
        continue;
      }

      candidateCount++;

      const settings = await getNotificationSettings(b.tenant_id);
      const smsAllowed = await smsAllowedForTenant(b.tenant_id);

      const reminderEmailEnabled = settings?.reminder_email_enabled ?? true;
      const reminderSmsEnabled = settings?.reminder_sms_enabled ?? false;

      const wantsEmail = Boolean(b.client_email && reminderEmailEnabled);
      const wantsSms = Boolean(
        b.client_phone && reminderSmsEnabled && smsAllowed
      );

      let emailSent = false;
      let smsSent = false;

      if (wantsEmail) {
        try {
          const tokens = await ensureBookingClientTokens(b.id);

          if (tokens?.cancel_token && tokens?.reschedule_token) {
            const { cancelUrl, rescheduleUrl } = bookingClientUrls(tokens);

            const bookingLocation = await fetchResolvedBarberLocation(
              b.barber_id,
              b.tenant_id,
            );

            await sendEmail({
              to: b.client_email!,
              subject: "Reminder programare",
              html: reminderEmailTemplate({
                time: b.start_time,
                cancelUrl,
                rescheduleUrl,
                location: bookingLocation,
              }),
            });

            emailSent = true;
          } else {
            console.error(
              "REMINDER EMAIL ERROR: missing tokens for booking",
              b.id,
            );
          }
        } catch (e) {
          console.error(
            "REMINDER EMAIL ERROR:",
            e
          );
        }
      }

      if (wantsSms) {
        try {
          const smsResult = await sendSms({
            phone: b.client_phone!,
            message:
`Frizeo

Reminder

Ai programare astazi la ora ${b.start_time.slice(0, 5)}.

Te asteptam!`,
          });

          smsSent = smsResult.ok;
        } catch (e) {
          console.error(
            "REMINDER SMS ERROR:",
            e
          );
        }
      }

      const delivered = emailSent || smsSent;
      const nothingToSend = !wantsEmail && !wantsSms;

      if (delivered) {
        await supabaseAdmin
          .from("bookings")
          .update({
            reminder_2h_sent: true,
          })
          .eq("id", b.id);

        sentCount++;
      } else if (nothingToSend) {
        await supabaseAdmin
          .from("bookings")
          .update({
            reminder_2h_sent: true,
          })
          .eq("id", b.id);

        skippedCount++;
      } else {
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
      candidates: candidateCount,
      dates: [today, tomorrow],
    });

  } catch (err) {

    console.error(
      "CRON ERROR:",
      err
    );

    return NextResponse.json(
      {
        error: "Server error",
      },
      {
        status: 500,
      }
    );
  }
}

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

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const in2h = new Date(
      now.getTime() + 2 * 60 * 60 * 1000
    );

    const today =
      now.toISOString().split("T")[0];

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
        .eq("date", today);

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

    for (const b of bookings || []) {

      const bookingTime =
        new Date(
          `${b.date}T${b.start_time}`
        );

      if (
        bookingTime > now &&
        bookingTime <= in2h
      ) {

        const settings =
          await getNotificationSettings(
            b.tenant_id
          );

        const smsAllowed = await smsAllowedForTenant(b.tenant_id);

        // =========================
        // EMAIL
        // =========================

        if (b.client_email && settings?.reminder_email_enabled) {

          try {
            const tokens = await ensureBookingClientTokens(b.id);

            if (!tokens?.cancel_token || !tokens?.reschedule_token) {
              continue;
            }

            const { cancelUrl, rescheduleUrl } = bookingClientUrls(tokens);

            await sendEmail({
              to: b.client_email,
              subject: "Reminder programare",
              html: reminderEmailTemplate({
                time: b.start_time,
                cancelUrl,
                rescheduleUrl,
              }),
            });

          } catch (e) {

            console.error(
              "REMINDER EMAIL ERROR:",
              e
            );

          }
        }

        // =========================
        // SMS
        // =========================

        if (
          b.client_phone &&
          settings?.reminder_sms_enabled &&
          smsAllowed
        ) {

          try {

            await sendSms({
              phone: b.client_phone,

              message:
`Frizeo

Reminder

Ai programare astazi la ora ${b.start_time}.

Te asteptam!`,
            });

          } catch (e) {

            console.error(
              "REMINDER SMS ERROR:",
              e
            );

          }
        }

        // =========================
        // ANTI DUPLICATE
        // =========================

        await supabaseAdmin
          .from("bookings")
          .update({
            reminder_2h_sent: true,
          })
          .eq("id", b.id);

        sentCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
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
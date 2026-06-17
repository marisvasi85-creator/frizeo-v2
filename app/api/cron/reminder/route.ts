import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { sendSms } from "@/lib/sms/sendSms";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const now = new Date();
    const in2h = new Date(
      now.getTime() + 2 * 60 * 60 * 1000
    );

    const today =
      now.toISOString().split("T")[0];

    // 🔥 CLEANUP PENDING

    await supabase
      .from("bookings")
      .delete()
      .eq("status", "pending")
      .lt("expires_at", now.toISOString());

    // 🔥 BOOKINGS

    const { data: bookings, error } =
      await supabase
        .from("bookings")
        .select(`
          id,
          tenant_id,
          client_email,
          client_phone,
          date,
          start_time,
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

        // =========================
        // EMAIL
        // =========================

        if (
          b.client_email &&
          settings?.reminder_email_enabled
        ) {

          try {

            await sendEmail({
              to: b.client_email,
              subject:
                "Reminder programare",

              html: `
                <div style="font-family: Arial">

                  <h2>
                    Ne vedem în curând ✂️
                  </h2>

                  <p>
                    Acesta este un reminder că ai o programare astăzi la ora
                    <b> ${b.start_time}</b>.
                  </p>

                  <p>
                    Te rugăm să ajungi cu câteva minute înainte.
                  </p>

                  <p>
                    Îți mulțumim!
                  </p>

                </div>
              `,
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
          settings?.reminder_sms_enabled
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

        await supabase
          .from("bookings")
          .update({
            reminder_2h_sent: true,
          })
          .eq("id", b.id);

        sentCount++;
      }
    }

    console.log(
      "REMINDER OK:",
      sentCount
    );

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
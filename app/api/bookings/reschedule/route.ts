import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { rescheduleConfirmationTemplate } from "@/lib/email/templates/reschedule-confirmation";
import { deleteGoogleEvent } from "@/lib/google/deleteEvent";
import { createGoogleEvent } from "@/lib/google/createEvent";
import { refreshAccessToken } from "@/lib/google/refreshAccessToken";
import { sendSms } from "@/lib/sms/sendSms";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const body = await req.json();

    const {
      token,
      new_date,
      new_start_time,
      new_end_time,

      // 🔥 ADAUGAT (din edit modal)
      client_name,
      client_phone,
      client_email,
    } = body;

    if (!token || !new_date || !new_start_time || !new_end_time) {
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

    // 🔥 FOLOSIM DATELE NOI SAU FALLBACK
    const finalName = client_name ?? oldBooking.client_name;
    const finalPhone = client_phone ?? oldBooking.client_phone;
    const finalEmail = client_email ?? oldBooking.client_email;
    const settings =
  await getNotificationSettings(
    oldBooking.tenant_id
  );
    // 🔥 CREATE BOOKING NOU (RPC)
    const { data: newBooking, error: rpcError } =
      await supabase.rpc("create_booking_safe_v2", {
        p_barber_id: oldBooking.barber_id,
        p_barber_service_id: barberServiceId,
        p_date: new_date,
        p_start: new_start_time,
        p_end: new_end_time,
        p_client_name: finalName,
        p_client_phone: finalPhone,
        p_client_email: finalEmail,
        p_reschedule_count: (oldBooking.reschedule_count || 0) + 1,
        p_exclude_booking_id: oldBooking.id,
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

    try {
      const { data: barber } = await supabase
        .from("barbers")
        .select("user_id")
        .eq("id", oldBooking.barber_id)
        .single();

      if (barber?.user_id) {
        const { data: userData } =
          await supabase.auth.admin.getUserById(barber.user_id);

        barberEmail = userData?.user?.email || null;
      }
    } catch (e) {
      console.error("BARBER ERROR:", e);
    }

    if (barberEmail) {
      await sendEmail({
        to: barberEmail,
        subject: "Programare reprogramată",
        html: `Programare modificată:
        ${new_date} ${new_start_time}`,
      });
    }

    // 🔥 GOOGLE CALENDAR RESCHEDULE

try {

  if (oldBooking.google_event_id) {

    const { data: googleAccount } =
      await supabase
        .from("barber_google_accounts")
        .select("*")
        .eq("barber_id", oldBooking.barber_id)
        .single();

    if (googleAccount?.access_token) {

      let accessToken =
        googleAccount.access_token;

      const expiresAt = new Date(
        googleAccount.expires_at
      );

      const shouldRefresh =
        expiresAt.getTime() <
        Date.now() + 5 * 60 * 1000;

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
                  refreshed.expires_in *
                    1000
              ).toISOString(),
            })
            .eq(
              "barber_id",
              oldBooking.barber_id
            );
        }
      }

      // DELETE EVENT VECHI

      await deleteGoogleEvent({
        accessToken,
        calendarId:
          googleAccount.calendar_id ||
          "primary",
        eventId:
          oldBooking.google_event_id,
      });

      // SERVICE

      const { data: service } =
        await supabase
          .from("barber_services")
          .select("display_name,name")
          .eq(
            "id",
            newBooking.barber_service_id
          )
          .single();

      const serviceName =
        service?.display_name ||
        service?.name ||
        "Serviciu";

      // CREATE EVENT NOU

      const event =
        await createGoogleEvent({
          accessToken,

          calendarId:
            googleAccount.calendar_id ||
            "primary",

          title:
            `${finalName} | ${finalPhone} | ${serviceName}`,

          description:
`Client: ${finalName}
Telefon: ${finalPhone}
Serviciu: ${serviceName}`,

          start:
            `${newBooking.date}T${newBooking.start_time}`,

          end:
            `${newBooking.date}T${newBooking.end_time}`,
        });

      if (event?.id) {

        await supabase
          .from("bookings")
          .update({
            google_event_id:
              event.id,
          })
          .eq(
            "id",
            newBooking.id
          );

        console.log(
          "GOOGLE EVENT RECREATED:",
          event.id
        );
      }
    }
  }

} catch (e) {

  console.error(
    "GOOGLE RESCHEDULE ERROR:",
    e
  );

}

    // 🔥 ANULEAZĂ VECHIUL BOOKING
    await supabase
      .from("bookings")
      .update({
        status: "cancelled",
        reschedule_token: null,
      })
      .eq("id", oldBooking.id);

    // 🔥 EMAIL CLIENT
    if (
  finalEmail &&
  settings?.reschedule_email_enabled
) {
      try {
        const baseUrl =
          process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        const cancelLink = `${baseUrl}/cancel/${newBooking.cancel_token}`;
        const rescheduleLink = `${baseUrl}/reschedule/${newBooking.reschedule_token}`;

        const html = rescheduleConfirmationTemplate({
          barberName: "Barber",
          date: new_date,
          time: new_start_time,
          cancelLink,
          rescheduleLink,
        });

        await sendEmail({
          to: finalEmail,
          subject: "Programare reprogramată",
          html,
        });

      } catch (e) {
        console.error("EMAIL ERROR:", e);
      }
    }


    // 🔥 SMS CLIENT

if (
  finalPhone &&
  settings?.reschedule_sms_enabled
) {

  try {

    await sendSms({
      phone: finalPhone,

      message:
`Frizeo

Programarea ta a fost reprogramata.

${new_date}
${new_start_time}`,
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
    });

  } catch (err) {
    console.error("RESCHEDULE ERROR:", err);

    return NextResponse.json(
      { error: "Eroare internă (rescheduling)" },
      { status: 500 }
    );
  }
}
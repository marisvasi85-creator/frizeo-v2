import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/email";
import { cancelBookingTemplate } from "@/lib/email/templates/cancel-booking";
import { deleteGoogleEvent } from "@/lib/google/deleteEvent";
import { refreshAccessToken } from "@/lib/google/refreshAccessToken";
import { sendSms } from "@/lib/sms/sendSms";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { token, bookingId } = body;

    const supabase = await createSupabaseServerClient();

    let booking = null;

    // 🔥 ADMIN
    if (bookingId) {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      booking = data;
    }

    // 🔥 PUBLIC
    if (token) {
      const { data } = await supabase
        .from("bookings")
        .select("*")
        .eq("cancel_token", token)
        .single();

      booking = data;
    }

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // 🔥 GOOGLE CALENDAR

try {

  if (booking.google_event_id) {

    const { data: googleAccount } =
      await supabase
        .from("barber_google_accounts")
        .select("*")
        .eq("barber_id", booking.barber_id)
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
              booking.barber_id
            );
        }
      }

      await deleteGoogleEvent({
        accessToken,
        calendarId:
          googleAccount.calendar_id ||
          "primary",
        eventId:
          booking.google_event_id,
      });

      console.log(
        "GOOGLE EVENT DELETED:",
        booking.google_event_id
      );
    }
  }

} catch (e) {

  console.error(
    "GOOGLE DELETE ERROR:",
    e
  );

}

// 🔥 UPDATE STATUS

await supabase
  .from("bookings")
  .update({
    status: "cancelled",
  })
  .eq("id", booking.id);
  
    // 🔥 EMAIL CLIENT
    if (booking.client_email) {
      await sendEmail({
        to: booking.client_email,
        subject: "Programare anulată",
        html: cancelBookingTemplate({
          clientName: booking.client_name,
          date: booking.date,
          time: `${booking.start_time} - ${booking.end_time}`,
        }),
      });
    }

    // 🔥 SMS CLIENT

try {

  if (booking.client_phone) {

    await sendSms({
      phone: booking.client_phone,

      message:
`Frizeo

Programarea ta a fost anulata.

${booking.date}
${booking.start_time}`,
    });

  }

} catch (e) {

  console.error(
    "SMS CANCEL ERROR:",
    e
  );

}

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
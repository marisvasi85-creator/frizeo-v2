import { NextRequest, NextResponse } from "next/server";
import {
  bookingAccessibleByUser,
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/email";
import { cancelBookingTemplate } from "@/lib/email/templates/cancel-booking";
import { deleteGoogleEvent } from "@/lib/google/deleteEvent";
import { refreshAccessToken } from "@/lib/google/refreshAccessToken";
import { sendSms } from "@/lib/sms/sendSms";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";
import { smsAllowedForTenant } from "@/lib/billing/smsAllowedForTenant";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { token, bookingId } = body;

    let booking = null;

    if (bookingId) {
      const auth = await requireTenantAccess(["owner", "manager", "barber"]);

      if (isAuthError(auth)) {
        return auth;
      }

      const barberId =
        auth.role === "barber"
          ? await getCurrentBarberId(auth.user.id, auth.tenantId)
          : null;

      const canAccess = await bookingAccessibleByUser(
        bookingId,
        auth.tenantId,
        auth.role,
        barberId
      );

      if (!canAccess) {
        return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
      }

      const { data } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      booking = data;
    }

    if (token) {
      const { data } = await supabaseAdmin
        .from("bookings")
        .select("*")
        .eq("cancel_token", token)
        .single();

      booking = data;
    }

    if (!booking) {
      return NextResponse.json(
        { error: "Programarea nu a fost găsită" },
        { status: 404 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json(
        { error: "Programarea este deja anulată" },
        { status: 400 }
      );
    }

    const settings = await getNotificationSettings(booking.tenant_id);
    const smsAllowed = await smsAllowedForTenant(booking.tenant_id);

    try {
      if (booking.google_event_id) {
        const { data: googleAccount } = await supabaseAdmin
          .from("barber_google_accounts")
          .select("*")
          .eq("barber_id", booking.barber_id)
          .single();

        if (googleAccount?.access_token) {
          let accessToken = googleAccount.access_token;

          const expiresAt = new Date(googleAccount.expires_at);

          const shouldRefresh =
            expiresAt.getTime() < Date.now() + 5 * 60 * 1000;

          if (shouldRefresh && googleAccount.refresh_token) {
            const refreshed = await refreshAccessToken(
              googleAccount.refresh_token
            );

            if (refreshed?.access_token) {
              accessToken = refreshed.access_token;

              await supabaseAdmin
                .from("barber_google_accounts")
                .update({
                  access_token: refreshed.access_token,
                  expires_at: new Date(
                    Date.now() + refreshed.expires_in * 1000
                  ).toISOString(),
                })
                .eq("barber_id", booking.barber_id);
            }
          }

          await deleteGoogleEvent({
            accessToken,
            calendarId: googleAccount.calendar_id || "primary",
            eventId: booking.google_event_id,
          });

          console.log("GOOGLE EVENT DELETED:", booking.google_event_id);
        }
      }
    } catch (e) {
      console.error("GOOGLE DELETE ERROR:", e);
    }

    await supabaseAdmin
      .from("bookings")
      .update({
        status: "cancelled",
      })
      .eq("id", booking.id);

    if (
      booking.client_email &&
      settings?.cancel_email_enabled
    ) {
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

    if (
      booking.client_phone &&
      settings?.cancel_sms_enabled &&
      smsAllowed
    ) {
      try {
        await sendSms({
          phone: booking.client_phone,
          message: `Frizeo

Programarea ta din
${booking.date}
${booking.start_time}

a fost anulata.`,
        });
      } catch (e) {
        console.error("CANCEL SMS ERROR:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

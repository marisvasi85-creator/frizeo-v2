import { bookingAccessibleByUser } from "@/lib/auth/requireTenantAccess";
import { deleteGoogleEvent } from "@/lib/google/deleteEvent";
import { getAccessTokenForBarber } from "@/lib/google/getAccessTokenForBarber";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

export async function cancelBookingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const bookingId = asString(args.booking_id);
  const confirmed = asBoolean(args.confirmed);

  if (!bookingId) {
    return {
      ok: false,
      summary: "Lipsa booking_id. Folosește list_bookings ca să identifici programarea.",
      error: "missing_booking_id",
    };
  }

  const canAccess = await bookingAccessibleByUser(
    bookingId,
    ctx.tenantId,
    ctx.role,
    ctx.barberId,
  );
  if (!canAccess) {
    return {
      ok: false,
      summary: "Nu ai acces la această programare.",
      error: "forbidden",
    };
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, status, client_name, barber_id, google_event_id",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    return {
      ok: false,
      summary: "Programarea nu a fost găsită.",
      error: "not_found",
    };
  }

  if (booking.status === "cancelled") {
    return {
      ok: false,
      summary: "Programarea este deja anulată.",
      error: "already_cancelled",
    };
  }

  const proposal = {
    booking_id: booking.id,
    client_name: booking.client_name,
    date: booking.date,
    start_time: String(booking.start_time).slice(0, 5),
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: anulez programarea lui ${booking.client_name} din ${proposal.date} la ${proposal.start_time}.`,
      data: {
        needs_confirmation: true,
        action: "cancel_booking",
        proposal,
        instruct_user:
          "Cere confirmare. Dacă utilizatorul acceptă, apelează cancel_booking din nou cu confirmed=true.",
      },
    };
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", booking.id);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut anula programarea.",
      error: error.message,
    };
  }

  if (booking.google_event_id && booking.barber_id) {
    try {
      const google = await getAccessTokenForBarber(
        supabaseAdmin,
        booking.barber_id,
      );
      if (google) {
        await deleteGoogleEvent({
          accessToken: google.accessToken,
          calendarId: google.calendarId,
          eventId: booking.google_event_id,
        });
      }
    } catch (err) {
      console.error("assistant cancelBooking google:", err);
    }
  }

  return {
    ok: true,
    summary: `Programarea lui ${booking.client_name} a fost anulată.`,
    data: { booking_id: booking.id, status: "cancelled" },
  };
}

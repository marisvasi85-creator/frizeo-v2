import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { asBoolean } from "./helpers";
import {
  deleteBookingGoogleEvent,
  notifyBookingCancelled,
} from "./notifyBookingChange";
import { resolveBookingForAssistant } from "./resolveBooking";

export async function cancelBookingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const confirmed = asBoolean(args.confirmed);

  const resolved = await resolveBookingForAssistant(args, ctx);
  if (!resolved.ok) return resolved.result;

  const booking = resolved.booking;

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
          "Prezintă propunerea. Utilizatorul confirmă din butoanele din chat (nu seta confirmed=true singur).",
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

  await deleteBookingGoogleEvent({
    barberId: booking.barber_id,
    googleEventId: booking.google_event_id,
  });

  await notifyBookingCancelled({ booking });

  return {
    ok: true,
    summary: `Programarea lui ${booking.client_name} a fost anulată. Clientul a fost notificat dacă e activ în setări.`,
    data: { booking_id: booking.id, status: "cancelled" },
  };
}

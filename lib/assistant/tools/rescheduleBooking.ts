import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { findSlotsTool } from "./findSlots";
import { asBoolean, asNumber, asString, normalizeTime } from "./helpers";
import { resolveBookingForAssistant } from "./resolveBooking";
import { updateBookingTool } from "./updateBooking";

function resolveDate(args: Record<string, unknown>): string | null {
  const date = asString(args.date);
  if (date) return date;

  const when = asString(args.when)?.toLowerCase();
  const today = getTodayInBookingTimezone();
  if (when === "today") return today;
  if (when === "tomorrow") return addDaysToDateString(today, 1);
  return null;
}

/**
 * Guided reschedule: resolve booking → suggest free slots OR propose/confirm move.
 */
export async function rescheduleBookingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const resolved = await resolveBookingForAssistant(args, ctx);
  if (!resolved.ok) return resolved.result;

  const booking = resolved.booking;
  const targetDate = resolveDate(args);
  const startRaw = asString(args.start_time) || asString(args.time);
  const confirmed = asBoolean(args.confirmed);

  if (!targetDate) {
    return {
      ok: false,
      summary:
        "Specifică noua dată (date=YYYY-MM-DD sau when=today|tomorrow).",
      error: "missing_date",
      data: {
        booking_id: booking.id,
        client_name: booking.client_name,
        current: {
          date: booking.date,
          start_time: String(booking.start_time).slice(0, 5),
        },
      },
    };
  }

  if (!booking.barber_service_id) {
    return {
      ok: false,
      summary:
        "Programarea nu are serviciu setat. Folosește update_booking cu barber_service_id.",
      error: "missing_service",
    };
  }

  if (!startRaw) {
    const slotsResult = await findSlotsTool(
      {
        date: targetDate,
        service_id: booking.barber_service_id,
        barber_id: booking.barber_id,
        exclude_booking_id: booking.id,
        limit: asNumber(args.limit) ?? 12,
      },
      ctx,
    );

    const slotsData =
      slotsResult.data && typeof slotsResult.data === "object"
        ? (slotsResult.data as Record<string, unknown>)
        : {};

    return {
      ok: slotsResult.ok,
      summary: slotsResult.ok
        ? `Programarea lui ${booking.client_name} e acum pe ${booking.date} la ${String(booking.start_time).slice(0, 5)}. ${slotsResult.summary} Alege o oră și apelează reschedule_booking cu start_time (fără confirmed).`
        : slotsResult.summary,
      error: slotsResult.error,
      data: {
        action: "reschedule_booking",
        needs_time_choice: true,
        booking_id: booking.id,
        client_name: booking.client_name,
        from: {
          date: booking.date,
          start_time: String(booking.start_time).slice(0, 5),
        },
        to_date: targetDate,
        ...slotsData,
        instruct_user:
          "Prezintă orele libere. Când utilizatorul alege o oră, apelează reschedule_booking cu booking_id, date/when, start_time (confirmed=false). Confirmarea finală se face din butoane.",
      },
    };
  }

  const start_time = normalizeTime(startRaw);

  const result = await updateBookingTool(
    {
      booking_id: booking.id,
      date: targetDate,
      start_time,
      confirmed,
      barber_service_id: booking.barber_service_id,
    },
    ctx,
  );

  if (
    result.data &&
    typeof result.data === "object" &&
    (result.data as { needs_confirmation?: boolean }).needs_confirmation
  ) {
    return {
      ...result,
      data: {
        ...(result.data as Record<string, unknown>),
        action: "reschedule_booking",
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoanele din chat.",
      },
    };
  }

  return result;
}

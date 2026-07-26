import { assertBookingLeadTimeForBarber } from "@/lib/bookings/bookingLeadTime";
import { getActiveBookings } from "@/lib/schedule/bookings";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import {
  addMinutesToTime,
  jsDayToScheduleDay,
  timesOverlap,
} from "@/lib/schedule/time";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { asBoolean, asString, normalizeTime } from "./helpers";
import { syncAndNotifyBookingRescheduled } from "./notifyBookingChange";
import { resolveBookingForAssistant } from "./resolveBooking";

export async function updateBookingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const date = asString(args.date);
  const startRaw = asString(args.start_time) || asString(args.time);
  const confirmed = asBoolean(args.confirmed);

  if (!date || !startRaw) {
    return {
      ok: false,
      summary: "Lipsa data sau ora noii programări.",
      error: "missing_datetime",
    };
  }

  const resolved = await resolveBookingForAssistant(args, ctx);
  if (!resolved.ok) return resolved.result;

  const booking = resolved.booking;
  const start_time = normalizeTime(startRaw);

  const serviceId = asString(args.barber_service_id) || booking.barber_service_id;
  const { data: service } = serviceId
    ? await supabaseAdmin
        .from("barber_services")
        .select("id, display_name, name, duration")
        .eq("id", serviceId)
        .maybeSingle()
    : { data: null };

  const duration = service?.duration || 30;
  const end_time = addMinutesToTime(start_time, duration);
  const serviceName =
    service?.display_name || service?.name || "Serviciu";

  const proposal = {
    booking_id: booking.id,
    client_name: booking.client_name,
    from: {
      date: booking.date,
      start_time: String(booking.start_time).slice(0, 5),
    },
    to: {
      date,
      start_time,
      end_time: String(end_time).slice(0, 5),
    },
    service_name: serviceName,
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: mut programarea lui ${booking.client_name} de pe ${proposal.from.date} ${proposal.from.start_time} pe ${date} la ${start_time}.`,
      data: {
        needs_confirmation: true,
        action: "update_booking",
        proposal,
        instruct_user:
          "Prezintă propunerea. Utilizatorul confirmă din butoanele din chat (nu seta confirmed=true singur).",
      },
    };
  }

  const day = jsDayToScheduleDay(date);
  const [{ data: schedule }, { data: override }, { data: existing }] =
    await Promise.all([
      supabaseAdmin
        .from("barber_weekly_schedule")
        .select("*")
        .eq("barber_id", booking.barber_id)
        .eq("day_of_week", day)
        .maybeSingle(),
      supabaseAdmin
        .from("barber_day_overrides")
        .select("*")
        .eq("barber_id", booking.barber_id)
        .eq("date", date)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select("id, start_time, end_time, status, expires_at")
        .eq("date", date)
        .eq("barber_id", booking.barber_id)
        .neq("id", booking.id)
        .in("status", ["confirmed", "pending"]),
    ]);

  const daySchedule = resolveDaySchedule(schedule, override);
  if (!daySchedule.isWorking) {
    return {
      ok: false,
      summary: "Ziua selectată nu este disponibilă (închis / concediu).",
      error: "day_closed",
    };
  }

  if (
    daySchedule.breakEnabled &&
    daySchedule.breakStart &&
    daySchedule.breakEnd &&
    timesOverlap(
      start_time,
      end_time,
      daySchedule.breakStart,
      daySchedule.breakEnd,
    )
  ) {
    return {
      ok: false,
      summary: "Nu poți muta programarea peste pauză.",
      error: "break_overlap",
    };
  }

  const overlap = getActiveBookings(existing).some((b) =>
    timesOverlap(start_time, end_time, b.start_time, b.end_time),
  );

  if (overlap) {
    return {
      ok: false,
      summary: "Slotul ales este ocupat.",
      error: "slot_taken",
    };
  }

  const leadTime = await assertBookingLeadTimeForBarber(
    supabaseAdmin,
    booking.barber_id,
    date,
    start_time,
    { bypassMinNotice: true },
  );

  if (!leadTime.ok) {
    return {
      ok: false,
      summary: leadTime.error,
      error: "lead_time",
    };
  }

  const previousGoogleEventId = booking.google_event_id;

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      client_name: booking.client_name,
      client_phone: booking.client_phone,
      client_email: booking.client_email ?? null,
      client_notes: booking.client_notes ?? null,
      barber_service_id: serviceId,
      date,
      start_time,
      end_time,
      google_event_id: null,
    })
    .eq("id", booking.id);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut muta programarea.",
      error: error.message,
    };
  }

  await syncAndNotifyBookingRescheduled({
    booking: {
      id: booking.id,
      tenant_id: booking.tenant_id,
      barber_id: booking.barber_id,
      date,
      start_time,
      end_time,
      client_name: booking.client_name,
      client_phone: booking.client_phone,
      client_email: booking.client_email,
      client_notes: booking.client_notes,
    },
    previousGoogleEventId,
    serviceName,
  });

  return {
    ok: true,
    summary: `Programarea lui ${booking.client_name} a fost mutată pe ${date} la ${start_time}. Clientul a fost notificat dacă e activ în setări.`,
    data: { booking_id: booking.id, date, start_time, end_time },
  };
}

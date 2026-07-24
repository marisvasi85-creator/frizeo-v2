import { requireActiveBarberForNewBooking } from "@/lib/barbers/requireActiveBarberForBooking";
import { checkBookingLimit } from "@/lib/billing/checkBookingLimit";
import { assertBookingLeadTimeForBarber } from "@/lib/bookings/bookingLeadTime";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { bookingClientUrls } from "@/lib/bookings/bookingClientUrls";
import { normalizeClientNotes } from "@/lib/bookings/normalizeClientNotes";
import { buildClientCalendarLinks } from "@/lib/calendar/buildClientCalendarLinks";
import { sendEmail } from "@/lib/email/email";
import { barberNewBookingTemplate } from "@/lib/email/templates/barber-new-booking";
import { clientConfirmationTemplate } from "@/lib/email/templates/client-confirmation";
import { syncBookingToGoogleCalendar } from "@/lib/google/syncBookingEvent";
import { fetchResolvedBarberLocation } from "@/lib/location/fetchResolvedBarberLocation";
import { getNotificationSettings } from "@/lib/notifications/getNotificationSettings";
import { extendedSmsAllowedForTenant } from "@/lib/billing/smsAllowedForTenant";
import { getActiveBookings } from "@/lib/schedule/bookings";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import {
  addMinutesToTime,
  jsDayToScheduleDay,
  timesOverlap,
} from "@/lib/schedule/time";
import { sendSms } from "@/lib/sms/sendSms";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import {
  asBoolean,
  asString,
  isValidRoPhone,
  normalizeTime,
  resolveServiceForBarber,
  resolveTargetBarberId,
} from "./helpers";
import { ensureBookingClientTokens } from "@/lib/bookings/ensureBookingClientTokens";

function resolveDate(args: Record<string, unknown>): string | null {
  const date = asString(args.date);
  if (date) return date;

  const when = asString(args.when)?.toLowerCase();
  const today = getTodayInBookingTimezone();
  if (when === "today") return today;
  if (when === "tomorrow") return addDaysToDateString(today, 1);
  return null;
}

async function sendBookingNotifications(input: {
  booking: {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    barber_id: string;
    tenant_id: string;
    cancel_token?: string | null;
    reschedule_token?: string | null;
  };
  client_name: string;
  client_phone: string;
  client_email: string | null;
  notes: string | null;
  serviceName: string;
}) {
  const settings = await getNotificationSettings(input.booking.tenant_id);
  const smsAllowed = await extendedSmsAllowedForTenant(input.booking.tenant_id);

  let barberEmail: string | null = null;
  let barberName = "Barber";

  try {
    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("user_id, display_name")
      .eq("id", input.booking.barber_id)
      .single();

    barberName = barber?.display_name || "Barber";

    if (barber?.user_id) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
        barber.user_id,
      );
      barberEmail = userData?.user?.email || null;
    }
  } catch (e) {
    console.error("assistant create_booking barber lookup:", e);
  }

  const bookingLocation = await fetchResolvedBarberLocation(
    input.booking.barber_id,
    input.booking.tenant_id,
  );

  const formattedDate = new Date(input.booking.date).toLocaleDateString("ro-RO");
  const formattedTime = String(input.booking.start_time).slice(0, 5);
  const tokens = await ensureBookingClientTokens(input.booking.id);
  const bookingForUrls = {
    ...input.booking,
    cancel_token: tokens?.cancel_token ?? input.booking.cancel_token,
    reschedule_token: tokens?.reschedule_token ?? input.booking.reschedule_token,
  };
  const { cancelUrl, rescheduleUrl } = bookingClientUrls(bookingForUrls);

  const calendarLinks =
    tokens?.cancel_token && input.booking.end_time
      ? buildClientCalendarLinks({
          bookingId: input.booking.id,
          serviceName: input.serviceName,
          barberName,
          date: input.booking.date,
          startTime: input.booking.start_time,
          endTime: input.booking.end_time,
          cancelToken: tokens.cancel_token,
          locationAddress: bookingLocation?.formattedAddress,
          notes: input.notes,
          cancelUrl,
          rescheduleUrl,
        })
      : null;

  try {
    await syncBookingToGoogleCalendar(supabaseAdmin, input.booking, {
      clientName: input.client_name,
      clientPhone: input.client_phone,
      serviceName: input.serviceName,
      notes: input.notes,
    });
  } catch (e) {
    console.error("assistant create_booking google:", e);
  }

  if (input.client_email && settings?.booking_email_enabled) {
    try {
      await sendEmail({
        to: input.client_email,
        subject: "Programare confirmată",
        html: clientConfirmationTemplate({
          clientName: input.client_name,
          barberName,
          serviceName: input.serviceName,
          date: formattedDate,
          time: formattedTime,
          cancelUrl,
          rescheduleUrl,
          location: bookingLocation,
          notes: input.notes,
          googleCalendarUrl: calendarLinks?.googleUrl,
          icsUrl: calendarLinks?.icsUrl,
        }),
        icsContent: calendarLinks?.icsContent,
      });
    } catch (e) {
      console.error("assistant create_booking client email:", e);
    }
  }

  if (
    input.client_phone &&
    settings?.booking_sms_enabled &&
    smsAllowed
  ) {
    try {
      await sendSms({
        phone: input.client_phone,
        message: `Frizeo

Programarea ta este confirmata.

${formattedDate}
${formattedTime}

${input.serviceName}${
          bookingLocation?.formattedAddress
            ? `\n\n${bookingLocation.formattedAddress}`
            : ""
        }`,
      });
    } catch (e) {
      console.error("assistant create_booking sms:", e);
    }
  }

  if (barberEmail && settings?.booking_email_enabled) {
    try {
      await sendEmail({
        to: barberEmail,
        subject: "Programare nouă",
        html: barberNewBookingTemplate({
          clientName: input.client_name,
          phone: input.client_phone,
          serviceName: input.serviceName,
          date: formattedDate,
          time: formattedTime,
          notes: input.notes,
        }),
      });
    } catch (e) {
      console.error("assistant create_booking barber email:", e);
    }
  }
}

export async function createBookingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const clientName = asString(args.client_name) || asString(args.name);
  const clientPhone = asString(args.client_phone) || asString(args.phone);
  const clientEmail = asString(args.client_email) || asString(args.email);
  const notes = normalizeClientNotes(
    asString(args.client_notes) || asString(args.notes),
  );
  const date = resolveDate(args);
  const startRaw = asString(args.start_time) || asString(args.time);
  const confirmed = asBoolean(args.confirmed);

  if (!clientName) {
    return {
      ok: false,
      summary: "Lipsa numele clientului.",
      error: "missing_client_name",
    };
  }

  if (!clientPhone) {
    return {
      ok: false,
      summary: "Lipsa telefonul clientului.",
      error: "missing_client_phone",
    };
  }

  if (!isValidRoPhone(clientPhone)) {
    return {
      ok: false,
      summary: "Telefon invalid. Folosește format 07XXXXXXXX sau +40XXXXXXXXX.",
      error: "invalid_phone",
    };
  }

  if (!date || !startRaw) {
    return {
      ok: false,
      summary: "Specifică data (date sau when) și ora (start_time).",
      error: "missing_datetime",
    };
  }

  const start_time = normalizeTime(startRaw);

  const target = await resolveTargetBarberId(ctx, asString(args.barber_id));
  if (!target.barberId) {
    return {
      ok: false,
      summary: target.error || "Nu am găsit frizerul.",
      error: "missing_barber",
    };
  }

  const barberCheck = await requireActiveBarberForNewBooking(target.barberId);
  if (!barberCheck.ok) {
    return {
      ok: false,
      summary: barberCheck.error,
      error: "inactive_barber",
    };
  }

  if (barberCheck.barber.tenant_id !== ctx.tenantId) {
    return {
      ok: false,
      summary: "Frizerul nu aparține salonului.",
      error: "forbidden",
    };
  }

  const service = await resolveServiceForBarber(
    target.barberId,
    ctx.tenantId,
    asString(args.service_id) || asString(args.barber_service_id),
    asString(args.service_name),
  );

  if (!service.ok) {
    return {
      ok: false,
      summary: service.summary,
      error: service.error,
    };
  }

  const end_time = addMinutesToTime(start_time, service.service.duration);
  const serviceName =
    service.service.display_name || service.service.name || "Serviciu";

  const { data: barberRow } = await supabaseAdmin
    .from("barbers")
    .select("display_name")
    .eq("id", target.barberId)
    .maybeSingle();

  const proposal = {
    client_name: clientName,
    client_phone: clientPhone.replace(/\s/g, ""),
    client_email: clientEmail,
    client_notes: notes,
    date,
    start_time,
    end_time: String(end_time).slice(0, 5),
    service_id: service.service.id,
    service_name: serviceName,
    duration_minutes: service.service.duration,
    barber_id: target.barberId,
    barber_name: barberRow?.display_name || null,
  };

  if (!confirmed) {
    return {
      ok: true,
      summary: `Confirmare necesară: programez pe ${clientName} (${proposal.client_phone}) pe ${date} la ${start_time} — ${serviceName}${
        proposal.barber_name ? `, la ${proposal.barber_name}` : ""
      }.`,
      data: {
        needs_confirmation: true,
        action: "create_booking",
        proposal,
        instruct_user:
          "Cere confirmare. Dacă acceptă, apelează create_booking din nou cu aceleași date și confirmed=true.",
      },
    };
  }

  const day = jsDayToScheduleDay(date);
  const [{ data: schedule }, { data: override }, { data: existing }] =
    await Promise.all([
      supabaseAdmin
        .from("barber_weekly_schedule")
        .select("*")
        .eq("barber_id", target.barberId)
        .eq("day_of_week", day)
        .maybeSingle(),
      supabaseAdmin
        .from("barber_day_overrides")
        .select("*")
        .eq("barber_id", target.barberId)
        .eq("date", date)
        .maybeSingle(),
      supabaseAdmin
        .from("bookings")
        .select("id, start_time, end_time, status, expires_at")
        .eq("barber_id", target.barberId)
        .eq("date", date)
        .in("status", ["confirmed", "pending"]),
    ]);

  const resolved = resolveDaySchedule(schedule, override);
  if (!resolved.isWorking) {
    return {
      ok: false,
      summary: "Ziua selectată nu este disponibilă (închis / concediu).",
      error: "day_closed",
    };
  }

  if (
    resolved.breakEnabled &&
    resolved.breakStart &&
    resolved.breakEnd &&
    timesOverlap(start_time, end_time, resolved.breakStart, resolved.breakEnd)
  ) {
    return {
      ok: false,
      summary: "Nu poți programa peste pauză.",
      error: "break_overlap",
    };
  }

  const overlap = getActiveBookings(existing).some((b) =>
    timesOverlap(start_time, end_time, b.start_time, b.end_time),
  );

  if (overlap) {
    return {
      ok: false,
      summary: "Slotul ales este ocupat. Folosește find_slots pentru alternative.",
      error: "slot_taken",
    };
  }

  const leadTime = await assertBookingLeadTimeForBarber(
    supabaseAdmin,
    target.barberId,
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

  const limit = await checkBookingLimit(ctx.tenantId);
  if (!limit.allowed) {
    return {
      ok: false,
      summary:
        "Ai atins limita de programări a planului Free. Upgrade necesar din Abonament.",
      error: "plan_limit",
    };
  }

  const phoneNormalized = clientPhone.replace(/\s/g, "");

  const { data: booking, error } = await supabaseAdmin
    .from("bookings")
    .insert({
      barber_id: target.barberId,
      barber_service_id: service.service.id,
      tenant_id: ctx.tenantId,
      date,
      start_time,
      end_time,
      status: "confirmed",
      client_name: clientName,
      client_phone: phoneNormalized,
      client_email: clientEmail,
      client_notes: notes,
      cancel_token: crypto.randomUUID(),
      reschedule_token: crypto.randomUUID(),
    })
    .select(
      "id, date, start_time, end_time, client_name, client_phone, barber_id, tenant_id, cancel_token, reschedule_token",
    )
    .single();

  if (error || !booking) {
    return {
      ok: false,
      summary: "Nu am putut crea programarea.",
      error: error?.message || "insert_failed",
    };
  }

  await sendBookingNotifications({
    booking,
    client_name: clientName,
    client_phone: phoneNormalized,
    client_email: clientEmail,
    notes,
    serviceName,
  });

  return {
    ok: true,
    summary: `Programare creată: ${clientName} pe ${date} la ${start_time} — ${serviceName}.`,
    data: {
      booking_id: booking.id,
      date: booking.date,
      start_time: String(booking.start_time).slice(0, 5),
      end_time: String(booking.end_time).slice(0, 5),
      client_name: booking.client_name,
      service_name: serviceName,
      barber_name: proposal.barber_name,
    },
  };
}

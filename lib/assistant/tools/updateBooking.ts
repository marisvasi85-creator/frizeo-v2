import {
  bookingAccessibleByUser,
} from "@/lib/auth/requireTenantAccess";
import { assertBookingLeadTimeForBarber } from "@/lib/bookings/bookingLeadTime";
import { addMinutesToTime, timesOverlap } from "@/lib/schedule/time";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeTime(value: string): string {
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [h, m] = trimmed.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }
  return trimmed.slice(0, 5);
}

export async function updateBookingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const bookingId = asString(args.booking_id);
  const date = asString(args.date);
  const startRaw = asString(args.start_time) || asString(args.time);
  const confirmed = asBoolean(args.confirmed);

  if (!bookingId) {
    return {
      ok: false,
      summary: "Lipsa booking_id. Folosește list_bookings ca să identifici programarea.",
      error: "missing_booking_id",
    };
  }

  if (!date || !startRaw) {
    return {
      ok: false,
      summary: "Lipsa data sau ora noii programări.",
      error: "missing_datetime",
    };
  }

  const start_time = normalizeTime(startRaw);

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

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, end_time, status, client_name, client_phone, client_email, client_notes, barber_id, barber_service_id",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return {
      ok: false,
      summary: "Programarea nu a fost găsită.",
      error: bookingError?.message || "not_found",
    };
  }

  if (booking.status === "cancelled") {
    return {
      ok: false,
      summary: "Programarea este deja anulată.",
      error: "cancelled",
    };
  }

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
    service_name: service?.display_name || service?.name || null,
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
          "Cere confirmare. Dacă utilizatorul acceptă, apelează update_booking din nou cu confirmed=true.",
      },
    };
  }

  const { data: existing } = await supabaseAdmin
    .from("bookings")
    .select("id, start_time, end_time")
    .eq("date", date)
    .eq("barber_id", booking.barber_id)
    .neq("id", booking.id)
    .in("status", ["confirmed", "pending"]);

  const overlap = existing?.some((b) =>
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
    })
    .eq("id", booking.id);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut muta programarea.",
      error: error.message,
    };
  }

  return {
    ok: true,
    summary: `Programarea lui ${booking.client_name} a fost mutată pe ${date} la ${start_time}.`,
    data: { booking_id: booking.id, date, start_time, end_time },
  };
}

import { bookingAccessibleByUser } from "@/lib/auth/requireTenantAccess";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { findSlotsTool } from "./findSlots";
import { asBoolean, asNumber, asString, normalizeTime } from "./helpers";
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

async function resolveBookingForReschedule(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<
  | {
      ok: true;
      booking: {
        id: string;
        date: string;
        start_time: string;
        end_time: string;
        status: string;
        client_name: string;
        client_phone: string | null;
        barber_id: string;
        barber_service_id: string | null;
      };
    }
  | { ok: false; result: AssistantToolResult }
> {
  const bookingId = asString(args.booking_id);
  if (bookingId) {
    const canAccess = await bookingAccessibleByUser(
      bookingId,
      ctx.tenantId,
      ctx.role,
      ctx.barberId,
    );
    if (!canAccess) {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "Nu ai acces la această programare.",
          error: "forbidden",
        },
      };
    }

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, date, start_time, end_time, status, client_name, client_phone, barber_id, barber_service_id",
      )
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !booking) {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "Programarea nu a fost găsită.",
          error: error?.message || "not_found",
        },
      };
    }

    if (booking.status === "cancelled") {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "Programarea este deja anulată.",
          error: "cancelled",
        },
      };
    }

    return { ok: true, booking };
  }

  const clientName = asString(args.client_name) || asString(args.name);
  if (!clientName) {
    return {
      ok: false,
      result: {
        ok: false,
        summary:
          "Specifică booking_id sau client_name. Folosește list_bookings dacă e nevoie.",
        error: "missing_booking",
      },
    };
  }

  const today = getTodayInBookingTimezone();
  const fromDate = asString(args.from_date) || today;
  const toDate = asString(args.to_date) || addDaysToDateString(today, 14);
  const phone = asString(args.client_phone) || asString(args.phone);

  let barberIds: string[] = [];
  if (ctx.role === "barber") {
    if (!ctx.barberId) {
      return {
        ok: false,
        result: {
          ok: false,
          summary: "Nu am găsit profilul de frizer.",
          error: "missing_barber",
        },
      };
    }
    barberIds = [ctx.barberId];
  } else {
    const barberIdArg = asString(args.barber_id);
    if (barberIdArg) {
      barberIds = [barberIdArg];
    } else {
      const { data } = await supabaseAdmin
        .from("barbers")
        .select("id")
        .eq("tenant_id", ctx.tenantId);
      barberIds = (data ?? []).map((b) => b.id);
    }
  }

  if (barberIds.length === 0) {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "Nu există frizeri în salon.",
        error: "no_barbers",
      },
    };
  }

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, end_time, status, client_name, client_phone, barber_id, barber_service_id",
    )
    .in("barber_id", barberIds)
    .neq("status", "cancelled")
    .gte("date", fromDate)
    .lte("date", toDate)
    .ilike("client_name", `%${clientName}%`)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(10);

  if (phone) {
    query = query.eq("client_phone", phone.replace(/\s/g, ""));
  }

  const currentDate = asString(args.current_date);
  if (currentDate) {
    query = query.eq("date", currentDate);
  }

  const { data: matches, error } = await query;
  if (error) {
    return {
      ok: false,
      result: {
        ok: false,
        summary: "Nu am putut căuta programarea.",
        error: error.message,
      },
    };
  }

  if (!matches?.length) {
    return {
      ok: false,
      result: {
        ok: false,
        summary: `Nu am găsit programări pentru „${clientName}" în perioada ${fromDate}–${toDate}.`,
        error: "not_found",
      },
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      result: {
        ok: false,
        summary: `Am găsit ${matches.length} programări pentru „${clientName}". Specifică booking_id sau current_date.`,
        error: "ambiguous_booking",
        data: {
          candidates: matches.map((b) => ({
            booking_id: b.id,
            client_name: b.client_name,
            date: b.date,
            start_time: String(b.start_time).slice(0, 5),
            phone: b.client_phone,
          })),
        },
      },
    };
  }

  return { ok: true, booking: matches[0] };
}

/**
 * Guided reschedule: resolve booking → suggest free slots OR propose/confirm move.
 */
export async function rescheduleBookingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const resolved = await resolveBookingForReschedule(args, ctx);
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

  // No time yet → suggest free slots for the same service, excluding this booking.
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
        ? `Programarea lui ${booking.client_name} e acum pe ${booking.date} la ${String(booking.start_time).slice(0, 5)}. ${slotsResult.summary} Alege o oră și apelează reschedule_booking cu start_time (fără confirmed), apoi confirmă.`
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
          "Prezintă orele libere. Când utilizatorul alege o oră, apelează reschedule_booking cu booking_id, date/when, start_time (confirmed=false), apoi după confirmare cu confirmed=true.",
      },
    };
  }

  const start_time = normalizeTime(startRaw);

  // Delegate write + confirmation to update_booking (same validation path).
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
          "Cere confirmare. Dacă acceptă, apelează reschedule_booking din nou cu aceleași date (booking_id, date/when, start_time) și confirmed=true.",
      },
    };
  }

  return result;
}

import { bookingAccessibleByUser } from "@/lib/auth/requireTenantAccess";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { asString, phoneVariants } from "./helpers";

export type AssistantResolvedBooking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name: string;
  client_phone: string | null;
  client_email: string | null;
  client_notes: string | null;
  barber_id: string;
  barber_service_id: string | null;
  google_event_id: string | null;
  tenant_id: string;
};

const BOOKING_SELECT =
  "id, date, start_time, end_time, status, client_name, client_phone, client_email, client_notes, barber_id, barber_service_id, google_event_id, tenant_id";

export async function resolveBookingForAssistant(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<
  | { ok: true; booking: AssistantResolvedBooking }
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
      .select(BOOKING_SELECT)
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
          error: "already_cancelled",
        },
      };
    }

    return { ok: true, booking: booking as AssistantResolvedBooking };
  }

  const clientName = asString(args.client_name) || asString(args.name);
  const phone = asString(args.client_phone) || asString(args.phone);
  if (!clientName && !phone) {
    return {
      ok: false,
      result: {
        ok: false,
        summary:
          "Specifică booking_id, client_name sau client_phone. Folosește list_bookings dacă e nevoie.",
        error: "missing_booking",
      },
    };
  }

  const today = getTodayInBookingTimezone();
  const fromDate =
    asString(args.from_date) ||
    (phone && !clientName ? addDaysToDateString(today, -30) : today);
  const toDate = asString(args.to_date) || addDaysToDateString(today, 14);

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
    .select(BOOKING_SELECT)
    .in("barber_id", barberIds)
    .neq("status", "cancelled")
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(10);

  if (clientName) {
    query = query.ilike("client_name", `%${clientName}%`);
  }

  if (phone) {
    query = query.in("client_phone", phoneVariants(phone));
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
        summary: `Nu am găsit programări pentru „${clientName || phone}" în perioada ${fromDate}–${toDate}.`,
        error: "not_found",
      },
    };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      result: {
        ok: false,
        summary: `Am găsit ${matches.length} programări pentru „${clientName || phone}". Specifică booking_id sau current_date.`,
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

  return { ok: true, booking: matches[0] as AssistantResolvedBooking };
}

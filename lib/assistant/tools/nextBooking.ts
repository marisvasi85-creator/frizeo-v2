import {
  addDaysToDateString,
  getTodayInBookingTimezone,
  BOOKING_TIMEZONE,
} from "@/lib/bookings/bookingTimezone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AssistantToolContext, AssistantToolResult } from "../types";
import { asString, resolveTargetBarberId } from "./helpers";

function nowPartsInBucharest(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: BOOKING_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return {
    today: getTodayInBookingTimezone(now),
    time: `${hour}:${minute}`,
  };
}

async function enrichBooking(row: {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name: string | null;
  client_phone: string | null;
  barber_id: string;
  barber_service_id: string | null;
}) {
  const [{ data: service }, { data: barber }] = await Promise.all([
    row.barber_service_id
      ? supabaseAdmin
          .from("barber_services")
          .select("display_name, name, duration")
          .eq("id", row.barber_service_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from("barbers")
      .select("display_name")
      .eq("id", row.barber_id)
      .maybeSingle(),
  ]);

  return {
    id: row.id,
    date: row.date,
    start_time: String(row.start_time).slice(0, 5),
    end_time: String(row.end_time).slice(0, 5),
    status: row.status,
    client_name: row.client_name,
    client_phone: row.client_phone,
    service_name: service?.display_name || service?.name || null,
    duration_minutes: service?.duration ?? null,
    barber_name: barber?.display_name || null,
  };
}

export async function getNextBookingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const resolved = await resolveTargetBarberId(ctx, asString(args.barber_id));
  if (resolved.error || !resolved.barberId) {
    return {
      ok: false,
      summary: resolved.error || "Frizer lipsă",
      error: resolved.error,
    };
  }

  const { today, time } = nowPartsInBucharest();
  const horizon = addDaysToDateString(today, 30);

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, end_time, status, client_name, client_phone, barber_id, barber_service_id",
    )
    .eq("barber_id", resolved.barberId)
    .in("status", ["confirmed", "pending"])
    .gte("date", today)
    .lte("date", horizon)
    .order("date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(40);

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut încărca următoarea programare.",
      error: error.message,
    };
  }

  const upcoming = (data ?? []).find((row) => {
    if (row.date > today) return true;
    return String(row.start_time).slice(0, 5) >= time;
  });

  if (!upcoming) {
    return {
      ok: true,
      summary: "Nu ai nicio programare viitoare în următoarele 30 de zile.",
      data: { next_booking: null, checked_at: `${today} ${time}` },
    };
  }

  const booking = await enrichBooking(upcoming);
  return {
    ok: true,
    summary: `Următorul client: ${booking.client_name || "fără nume"} — ${booking.date} la ${booking.start_time}${
      booking.service_name ? ` (${booking.service_name})` : ""
    }.`,
    data: { next_booking: booking, checked_at: `${today} ${time}` },
  };
}

export async function getTodayBriefingTool(
  args: Record<string, unknown>,
  ctx: AssistantToolContext,
): Promise<AssistantToolResult> {
  const resolved = await resolveTargetBarberId(ctx, asString(args.barber_id));
  if (resolved.error || !resolved.barberId) {
    return {
      ok: false,
      summary: resolved.error || "Frizer lipsă",
      error: resolved.error,
    };
  }

  const { today, time } = nowPartsInBucharest();

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, date, start_time, end_time, status, client_name, client_phone, barber_id, barber_service_id",
    )
    .eq("barber_id", resolved.barberId)
    .eq("date", today)
    .in("status", ["confirmed", "pending"])
    .order("start_time", { ascending: true });

  if (error) {
    return {
      ok: false,
      summary: "Nu am putut încărca briefing-ul de azi.",
      error: error.message,
    };
  }

  const bookings = await Promise.all(
    (data ?? []).map((row) => enrichBooking(row)),
  );
  const remaining = bookings.filter((b) => b.start_time >= time);
  const next = remaining[0] ?? null;
  const doneCount = bookings.length - remaining.length;

  return {
    ok: true,
    summary:
      bookings.length === 0
        ? `Azi (${today}) nu ai programări.`
        : `Azi ai ${bookings.length} programări (${doneCount} trecute, ${remaining.length} rămase).${
            next
              ? ` Următorul: ${next.client_name || "client"} la ${next.start_time}.`
              : " Nu mai ai clienți azi."
          }`,
    data: {
      date: today,
      now_time: time,
      total: bookings.length,
      remaining_count: remaining.length,
      completed_count: doneCount,
      next_booking: next,
      bookings,
    },
  };
}

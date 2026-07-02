import type { SupabaseClient } from "@supabase/supabase-js";
import { parseBookingDateTime } from "@/lib/bookings/bookingTimezone";

export const DEFAULT_MIN_BOOKING_NOTICE_HOURS = 2;

export { parseBookingDateTime } from "@/lib/bookings/bookingTimezone";

export function clampMinNoticeHours(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return DEFAULT_MIN_BOOKING_NOTICE_HOURS;
  return Math.max(0, Math.min(168, Math.round(num)));
}

export function minNoticeErrorMessage(hours: number): string {
  if (hours <= 0) {
    return "Intervalul selectat nu mai este disponibil.";
  }

  if (hours === 1) {
    return "Programările online trebuie făcute cu cel puțin 1 oră înainte.";
  }

  return `Programările online trebuie făcute cu cel puțin ${hours} ore înainte.`;
}

export function getSlotEligibility({
  date,
  startTime,
  minNoticeHours,
  now = new Date(),
  bypassMinNotice = false,
}: {
  date: string;
  startTime: string;
  minNoticeHours: number;
  now?: Date;
  bypassMinNotice?: boolean;
}): { eligible: true } | { eligible: false; reason: "past" | "notice" } {
  const slotStart = parseBookingDateTime(date, startTime);

  if (slotStart.getTime() <= now.getTime()) {
    return { eligible: false, reason: "past" };
  }

  if (!bypassMinNotice && minNoticeHours > 0) {
    const earliest = new Date(
      now.getTime() + minNoticeHours * 60 * 60 * 1000,
    );

    if (slotStart.getTime() < earliest.getTime()) {
      return { eligible: false, reason: "notice" };
    }
  }

  return { eligible: true };
}

export function validateBookingLeadTime({
  date,
  startTime,
  minNoticeHours,
  now = new Date(),
  bypassMinNotice = false,
}: {
  date: string;
  startTime: string;
  minNoticeHours: number;
  now?: Date;
  bypassMinNotice?: boolean;
}): { ok: true } | { ok: false; error: string } {
  const slotStart = parseBookingDateTime(date, startTime);

  if (slotStart.getTime() <= now.getTime()) {
    return { ok: false, error: "Nu poți programa în trecut." };
  }

  if (!bypassMinNotice && minNoticeHours > 0) {
    const earliest = new Date(
      now.getTime() + minNoticeHours * 60 * 60 * 1000,
    );

    if (slotStart.getTime() < earliest.getTime()) {
      return {
        ok: false,
        error: minNoticeErrorMessage(minNoticeHours),
      };
    }
  }

  return { ok: true };
}

export function isSlotWithinLeadTime(
  date: string,
  startTime: string,
  minNoticeHours: number,
  now = new Date(),
  bypassMinNotice = false,
): boolean {
  return getSlotEligibility({
    date,
    startTime,
    minNoticeHours,
    now,
    bypassMinNotice,
  }).eligible;
}

export async function getBarberMinNoticeHours(
  supabase: SupabaseClient,
  barberId: string,
): Promise<number> {
  const { data } = await supabase
    .from("barbers")
    .select("min_booking_notice_hours")
    .eq("id", barberId)
    .maybeSingle();

  if (
    data?.min_booking_notice_hours === null ||
    data?.min_booking_notice_hours === undefined
  ) {
    return DEFAULT_MIN_BOOKING_NOTICE_HOURS;
  }

  return clampMinNoticeHours(data.min_booking_notice_hours);
}

export async function assertBookingLeadTimeForBarber(
  supabase: SupabaseClient,
  barberId: string,
  date: string,
  startTime: string,
  options?: { bypassMinNotice?: boolean; now?: Date },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const minNoticeHours = await getBarberMinNoticeHours(supabase, barberId);

  return validateBookingLeadTime({
    date,
    startTime,
    minNoticeHours,
    now: options?.now,
    bypassMinNotice: options?.bypassMinNotice,
  });
}

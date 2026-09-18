import { supabaseAdmin } from "@/lib/supabase/admin";
import { requireActiveBarberForNewBooking } from "@/lib/barbers/requireActiveBarberForBooking";
import { checkBookingLimit } from "@/lib/billing/checkBookingLimit";
import { reclaimExpiredHolds } from "@/lib/bookings/reclaimExpiredHolds";
import { assertBookingLeadTimeForBarber } from "@/lib/bookings/bookingLeadTime";
import {
  checkBarberBookingAccess,
  publicAccessMessage,
} from "@/lib/barber-access/server";
import {
  getGoogleBusyIntervalsForDate,
  slotOverlapsBusyIntervals,
} from "@/lib/google/getGoogleBusyIntervals";
import { getActiveBookings } from "@/lib/schedule/bookings";
import { resolveDaySchedule } from "@/lib/schedule/resolveDaySchedule";
import {
  addMinutesToTime,
  jsDayToScheduleDay,
  timeToMinutes,
  timesOverlap,
} from "@/lib/schedule/time";

export type ReservedHold = {
  id: string;
  barber_id: string;
  barber_service_id: string;
  tenant_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  expires_at: string | null;
  cancel_token: string | null;
  reschedule_token: string | null;
  created_via: string | null;
  [key: string]: unknown;
};

export type ReservePendingHoldInput = {
  barberId: string;
  barberServiceId: string;
  date: string;
  startTime: string;
  clientPhone?: string | null;
  isDashboardBooking?: boolean;
  bypassMinNotice?: boolean;
  bypassGoogleBusy?: boolean;
};

export type ReservePendingHoldResult =
  | { ok: true; hold: ReservedHold }
  | {
      ok: false;
      error: string;
      status: number;
      accessStatus?: string;
    };

function fail(
  error: string,
  status: number,
  accessStatus?: string,
): ReservePendingHoldResult {
  return accessStatus
    ? { ok: false, error, status, accessStatus }
    : { ok: false, error, status };
}

function slotFitsWorkWindow(
  startTime: string,
  endTime: string,
  workStart: string | null,
  workEnd: string | null,
): boolean {
  if (!workStart || !workEnd) return false;
  return (
    timeToMinutes(startTime) >= timeToMinutes(workStart) &&
    timeToMinutes(endTime) <= timeToMinutes(workEnd)
  );
}

export async function reservePendingHold(
  input: ReservePendingHoldInput,
): Promise<ReservePendingHoldResult> {
  const supabase = supabaseAdmin;
  const isDashboardBooking = input.isDashboardBooking === true;
  const bypassMinNotice = input.bypassMinNotice === true;
  const bypassGoogleBusy = input.bypassGoogleBusy === true;

  const barberCheck = await requireActiveBarberForNewBooking(input.barberId);
  if (!barberCheck.ok) {
    return fail(barberCheck.error, barberCheck.status);
  }

  const barber = barberCheck.barber;
  const day = jsDayToScheduleDay(input.date);

  const accessPromise = isDashboardBooking
    ? Promise.resolve(null)
    : checkBarberBookingAccess({
        barberId: input.barberId,
        phone: typeof input.clientPhone === "string" ? input.clientPhone : "",
      });

  const existingPromise = reclaimExpiredHolds(supabase, {
    barberId: input.barberId,
    date: input.date,
  }).then(() =>
    supabase
      .from("bookings")
      .select("start_time, end_time, status, expires_at")
      .eq("barber_id", input.barberId)
      .eq("date", input.date),
  );

  const [
    bookingAccess,
    { data: service },
    { data: schedule },
    { data: override },
    { data: barberRow },
    leadTime,
    limit,
    googleBusyIntervals,
    existingResult,
  ] = await Promise.all([
    accessPromise,
    supabase
      .from("barber_services")
      .select("duration")
      .eq("id", input.barberServiceId)
      .eq("barber_id", input.barberId)
      .eq("tenant_id", barber.tenant_id)
      .eq("active", true)
      .is("deleted_at", null)
      .single(),
    supabase
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", input.barberId)
      .eq("day_of_week", day)
      .maybeSingle(),
    supabase
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", input.barberId)
      .eq("date", input.date)
      .maybeSingle(),
    supabase
      .from("barbers")
      .select("schedule_mode")
      .eq("id", input.barberId)
      .maybeSingle(),
    assertBookingLeadTimeForBarber(
      supabase,
      input.barberId,
      input.date,
      input.startTime,
      { bypassMinNotice },
    ),
    checkBookingLimit(barber.tenant_id),
    bypassGoogleBusy
      ? Promise.resolve([])
      : getGoogleBusyIntervalsForDate(supabase, input.barberId, input.date),
    existingPromise,
  ]);

  if (bookingAccess && !bookingAccess.canBook) {
    return fail(
      publicAccessMessage(bookingAccess),
      403,
      bookingAccess.status,
    );
  }

  if (!service) {
    return fail("Serviciu invalid", 400);
  }

  if (!leadTime.ok) {
    return fail(leadTime.error, 400);
  }

  if (!limit.allowed) {
    return fail("Ai atins limita planului Free. Upgrade necesar.", 403);
  }

  const endTime = addMinutesToTime(input.startTime, service.duration);
  const scheduleMode =
    barberRow?.schedule_mode === "selective" ? "selective" : "weekly";
  const resolved = resolveDaySchedule(schedule, override, scheduleMode);

  if (
    !resolved.isWorking ||
    !slotFitsWorkWindow(
      input.startTime,
      endTime,
      resolved.workStart,
      resolved.workEnd,
    )
  ) {
    return fail("Ziua selectată nu este disponibilă", 400);
  }

  if (
    resolved.breakEnabled &&
    resolved.breakStart &&
    resolved.breakEnd &&
    timesOverlap(
      input.startTime,
      endTime,
      resolved.breakStart,
      resolved.breakEnd,
    )
  ) {
    return fail("Nu poți programa peste pauză", 400);
  }

  const active = getActiveBookings(existingResult.data);
  const overlap = active.some((booking) =>
    timesOverlap(
      input.startTime,
      endTime,
      booking.start_time,
      booking.end_time,
    ),
  );
  if (overlap) {
    return fail("Slot ocupat", 400);
  }

  if (
    !bypassGoogleBusy &&
    slotOverlapsBusyIntervals(input.startTime, endTime, googleBusyIntervals)
  ) {
    return fail("Slot ocupat", 400);
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      barber_id: input.barberId,
      barber_service_id: input.barberServiceId,
      tenant_id: barber.tenant_id,
      date: input.date,
      start_time: input.startTime,
      end_time: endTime,
      status: "pending",
      created_via: isDashboardBooking ? "dashboard" : "public",
      expires_at: expiresAt.toISOString(),
      cancel_token: crypto.randomUUID(),
      reschedule_token: crypto.randomUUID(),
    })
    .select()
    .single();

  if (error || !data) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("slot ocupat") || message.includes("already booked")) {
      return fail("Slot ocupat", 400);
    }
    return fail("Nu se poate crea hold", 400);
  }

  return { ok: true, hold: data as ReservedHold };
}

import { requireActsAsBarber } from "../lib/requireActsAsBarber";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

import BookingRulesForm from "./components/BookingRulesForm";
import ScheduleSettingsClient from "./components/ScheduleSettingsClient";
import SetupChecklistStepMarker from "../components/SetupChecklistStepMarker";
import { DEFAULT_MIN_BOOKING_NOTICE_HOURS } from "@/lib/bookings/bookingLeadTime";
import { normalizeScheduleMode } from "@/lib/schedule/resolveDaySchedule";

export default async function SettingsPage() {
  const session = await requireActsAsBarber();
  const barber = session.barber;
  if (!barber) redirect("/login");

  const [scheduleRes, overridesRes] = await Promise.all([
    supabaseAdmin
      .from("barber_weekly_schedule")
      .select("*")
      .eq("barber_id", barber.id),
    supabaseAdmin
      .from("barber_day_overrides")
      .select("*")
      .eq("barber_id", barber.id)
      .order("date", { ascending: true }),
  ]);

  const minBookingNoticeHours =
    (barber.min_booking_notice_hours as number | null | undefined) ??
    DEFAULT_MIN_BOOKING_NOTICE_HOURS;

  const scheduleMode = normalizeScheduleMode(
    barber.schedule_mode as string | null | undefined,
  );

  return (
    <div className="space-y-8">
      <SetupChecklistStepMarker barberId={barber.id} step="schedule" />

      <BookingRulesForm minBookingNoticeHours={minBookingNoticeHours} />

      <ScheduleSettingsClient
        barberId={barber.id}
        initialMode={scheduleMode}
        initialWeekly={scheduleRes.data ?? []}
        initialOverrides={overridesRes.data ?? []}
      />
    </div>
  );
}

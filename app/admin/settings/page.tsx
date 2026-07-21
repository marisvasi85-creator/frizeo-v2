import { getAdminSession } from "@/lib/auth/getAdminSession";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

import WeeklyScheduleEditor from "./components/WeeklyScheduleEditor";
import OverrideManager from "./components/OverrideManager";
import BookingRulesForm from "./components/BookingRulesForm";
import { DEFAULT_MIN_BOOKING_NOTICE_HOURS } from "@/lib/bookings/bookingLeadTime";

export default async function SettingsPage() {
  const session = await getAdminSession();
  const barber = session?.barber;

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

  return (
    <div className="space-y-8">
      <BookingRulesForm minBookingNoticeHours={minBookingNoticeHours} />

      <div>
        <h1 className="text-2xl font-semibold mb-4">Program de lucru</h1>

        <WeeklyScheduleEditor initialData={scheduleRes.data ?? []} />
      </div>

      <OverrideManager
        barberId={barber.id}
        initialOverrides={overridesRes.data ?? []}
      />
    </div>
  );
}

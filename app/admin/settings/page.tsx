import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";

import WeeklyScheduleEditor from "./components/WeeklyScheduleEditor";
import OverrideManager from "./components/OverrideManager";
import BookingRulesForm from "./components/BookingRulesForm";
import { DEFAULT_MIN_BOOKING_NOTICE_HOURS } from "@/lib/bookings/bookingLeadTime";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) redirect("/login");

  const { data: schedule } = await supabase
    .from("barber_weekly_schedule")
    .select("*")
    .eq("barber_id", barber.id);

  const minBookingNoticeHours =
    barber.min_booking_notice_hours ?? DEFAULT_MIN_BOOKING_NOTICE_HOURS;

  return (
    <div className="space-y-8">

      <BookingRulesForm minBookingNoticeHours={minBookingNoticeHours} />

      <div>
        <h1 className="text-2xl font-semibold mb-4">
          Program de lucru
        </h1>

        <WeeklyScheduleEditor
          initialData={schedule ?? []}
        />
      </div>

      <OverrideManager barberId={barber.id} />

    </div>
  );
}
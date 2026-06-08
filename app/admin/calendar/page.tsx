import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";
import DayCalendar from "../dashboard/barber/components/DayCalendar";

export default async function CalendarPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const barber = await getCurrentBarberInTenant();

  if (!barber) redirect("/login");

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-white mb-4">
        Calendar
      </h1>

      <DayCalendar barberId={barber.id} />
    </div>
  );
}
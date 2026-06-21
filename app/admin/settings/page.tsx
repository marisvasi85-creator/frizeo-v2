import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";

import WeeklyScheduleEditor from "./components/WeeklyScheduleEditor";
import OverrideManager from "./components/OverrideManager";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) redirect("/login");

  const { data: schedule } = await supabase
    .from("barber_weekly_schedule")
    .select("*")
    .eq("barber_id", barber.id);

  return (
    <div className="space-y-8">

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
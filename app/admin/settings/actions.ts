"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";

function toDBTime(t: string | null) {
  if (!t) return null;
  return t.length === 5 ? t + ":00" : t;
}

export async function saveWeeklySchedule(days: any[]) {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  console.log("🔥 SAVE DAYS:", days);

  // delete vechi
  await supabase
    .from("barber_weekly_schedule")
    .delete()
    .eq("barber_id", barber.id);

  // insert nou (🔥 FIX AICI)
  const rows = days.map((d) => ({
    barber_id: barber.id,
    tenant_id: barber.tenant_id,

    day_of_week: d.day_of_week,
    is_working: d.is_working,

    work_start: toDBTime(d.work_start),
    work_end: toDBTime(d.work_end),

    break_enabled: !!d.break_enabled,

    break_start: d.break_enabled
      ? toDBTime(d.break_start)
      : null,

    break_end: d.break_enabled
      ? toDBTime(d.break_end)
      : null,
  }));

  console.log("🔥 FINAL ROWS:", rows);

  const { error } = await supabase
    .from("barber_weekly_schedule")
    .insert(rows);

  if (error) {
  console.error("❌ INSERT ERROR:", error);
  return;
}

return;
}
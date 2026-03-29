"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";

export async function saveWeeklySchedule(days: any[]) {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  // delete vechi
  await supabase
    .from("barber_weekly_schedule")
    .delete()
    .eq("barber_id", barber.id);

  // insert nou
  const rows = days.map((d) => ({
    barber_id: barber.id,
    tenant_id: barber.tenant_id,
    day_of_week: d.day_of_week,
    is_working: d.is_working,
    work_start: d.work_start,
    work_end: d.work_end,
    break_enabled: d.break_enabled,
    break_start: d.break_start,
    break_end: d.break_end,
  }));

  await supabase.from("barber_weekly_schedule").insert(rows);

  // 🔥 redirect control flow
  redirect("/admin/dashboard");
}
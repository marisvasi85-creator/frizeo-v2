import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getDashboardStatus(userId: string) {
  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!barber) {
    return { step: "profile", completed: false };
  }

  const { data: services } = await supabaseAdmin
    .from("barber_services")
    .select("id")
    .eq("barber_id", barber.id)
    .limit(1);

  if (!services || services.length === 0) {
    return { step: "services", completed: false };
  }

  const { data: schedule } = await supabaseAdmin
    .from("barber_weekly_schedule")
    .select("id")
    .eq("barber_id", barber.id)
    .limit(1);

  if (!schedule || schedule.length === 0) {
    return { step: "schedule", completed: false };
  }

  return { completed: true };
}   
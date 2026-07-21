import { supabaseAdmin } from "@/lib/supabase/admin";

type DashboardStatus = {
  step: "profile" | "services" | "schedule" | "done";
  completed: boolean;
};

export default async function getDashboardStatus(
  userId: string,
  barberId?: string | null,
): Promise<DashboardStatus> {
  let resolvedBarberId = barberId ?? null;

  if (!resolvedBarberId) {
    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("id")
      .eq("user_id", userId)
      .single();

    resolvedBarberId = barber?.id ?? null;
  }

  if (!resolvedBarberId) {
    return {
      step: "profile",
      completed: false,
    };
  }

  const [{ data: services }, { data: schedule }] = await Promise.all([
    supabaseAdmin
      .from("barber_services")
      .select("id")
      .eq("barber_id", resolvedBarberId)
      .limit(1),
    supabaseAdmin
      .from("barber_weekly_schedule")
      .select("id")
      .eq("barber_id", resolvedBarberId)
      .limit(1),
  ]);

  if (!services || services.length === 0) {
    return {
      step: "services",
      completed: false,
    };
  }

  if (!schedule || schedule.length === 0) {
    return {
      step: "schedule",
      completed: false,
    };
  }

  return {
    step: "done",
    completed: true,
  };
}

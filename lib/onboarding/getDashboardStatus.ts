import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function getDashboardStatus(userId: string) {
  console.log("=================================");
  console.log("ONBOARDING USER:", userId);

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("user_id", userId)
    .single();

  console.log("BARBER:", barber);

  if (!barber) {
    console.log("STEP => profile");

    return {
      step: "profile",
      completed: false,
    };
  }

  const { data: services } = await supabaseAdmin
    .from("barber_services")
    .select("id")
    .eq("barber_id", barber.id)
    .limit(1);

  console.log("SERVICES:", services);

  if (!services || services.length === 0) {
    console.log("STEP => services");

    return {
      step: "services",
      completed: false,
    };
  }

  const { data: schedule } = await supabaseAdmin
    .from("barber_weekly_schedule")
    .select("id")
    .eq("barber_id", barber.id)
    .limit(1);

  console.log("SCHEDULE:", schedule);

  if (!schedule || schedule.length === 0) {
    console.log("STEP => schedule");

    return {
      step: "schedule",
      completed: false,
    };
  }

  console.log("STEP => done");

  return {
    step: "done",
    completed: true,
  };
}
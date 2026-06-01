import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import getDashboardStatus from "@/lib/onboarding/getDashboardStatus";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const status = await getDashboardStatus(user.id);

  // 🔥 PAS 1 → profile (nu ai barber)
  if (status.step === "profile") {
    redirect("/admin/services");
  }

  // 🔥 PAS 2 → servicii
  if (status.step === "services") {
    redirect("/admin/services");
  }

  // 🔥 PAS 3 → program
  if (status.step === "schedule") {
    redirect("/admin/settings");
  }

  // 🔥 DONE
  redirect("/admin/dashboard");
}
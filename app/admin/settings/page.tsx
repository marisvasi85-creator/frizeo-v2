import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { redirect } from "next/navigation";

export default async function AdminSettingsPage() {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/select-tenant");
  }

  return (
    <div>
      <h1>Settings – {barber.display_name}</h1>
    </div>
  );
}
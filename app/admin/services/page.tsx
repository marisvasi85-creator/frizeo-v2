// app/admin/services/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ServicesClient from "./ServicesClient";
import { getActiveTenant } from "@/lib/supabase/getActiveTenant";

export default async function AdminServicesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const tenant = await getActiveTenant();

  if (!tenant) {
    return <p>Nu ai un salon activ.</p>;
  }

  const { data: services, error } = await supabase
    .from("barber_services")
    .select(`
      id,
      display_name,
      duration,
      price,
      sort_order,
      show_price,
      featured,
      active
    `)
    .eq("tenant_id", tenant.tenant_id)
    .order("sort_order", { ascending: true });

  if (error) {
    return <p>Eroare: {error.message}</p>;
  }

  return (
    <ServicesClient
      services={services ?? []}
      tenantId={tenant.tenant_id}
    />
  );
}
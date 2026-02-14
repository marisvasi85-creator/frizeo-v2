"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* =========================
   FETCH SERVICES (ONBOARDING)
========================= */
export async function getServicesForOnboarding() {
  const supabase = await createSupabaseServerClient();

  // user logat
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  // tenant activ
  const { data: tenant, error: tenantError } = await supabase
    .from("user_active_tenant")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (tenantError || !tenant) {
    throw new Error("Tenant lipsă");
  }

  // servicii din tenant
  const { data, error } = await supabase
    .from("services")
    .select("id, name, price, active, sort_order")
    .eq("tenant_id", tenant.tenant_id)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;

  return data ?? [];
}

/* =========================
   ACTIVATE SERVICES FOR BARBER
========================= */
export async function onboardServices({
  serviceIds,
}: {
  serviceIds: string[];
}) {
  if (!serviceIds.length) return;
console.log("serviceIds:", serviceIds);

  const supabase = await createSupabaseServerClient();

  // user logat
  const {
    data: { user },
  } = await supabase.auth.getUser();
console.log("USER:", user);
  if (!user) throw new Error("User not authenticated");

  // tenant activ
  const { data: tenant, error: tenantError } = await supabase
    .from("user_active_tenant")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (tenantError || !tenant) {
    throw new Error("Tenant lipsă");
  }

  // barber al userului logat
  const { data: barber, error: barberError } = await supabase
  .from("barbers")
  .select("id")
  .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
  .single();


  if (barberError || !barber) {
  console.error(barberError);
  throw new Error("Barber lipsă");
}


  // servicii selectate din catalog (doar din tenant)
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, price")
    .in("id", serviceIds)
    .eq("tenant_id", tenant.tenant_id);

  if (servicesError || !services) {
    throw new Error("Servicii lipsă");
  }

  // deja activate?
  const { data: existing } = await supabase
    .from("barber_services")
    .select("service_id")
    .eq("barber_id", barber.id)
    .in("service_id", serviceIds);

  const existingIds = new Set(
    (existing ?? []).map((e) => e.service_id)
  );

  const rows = services
    .filter((s) => !existingIds.has(s.id))
    .map((s) => ({
      barber_id: barber.id,
      service_id: s.id,
      price: s.price,
      duration: 30, // default
      active: true,
      tenant_id: tenant.tenant_id,
    }));

  if (rows.length) {
  const { data, error } = await supabase
    .from("barber_services")
    .upsert(rows, {
      onConflict: "barber_id,service_id",
    })
    .select();

  console.log("UPSERT ERROR:", error);
  console.log("UPSERT DATA:", data);

  if (error) throw error;
}

  revalidatePath("/admin/services");
}

import { createSupabaseServerClient } from "@/lib/supabase/server";
import SelectClient from "./SelectClient";

export default async function SelectTenantPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <div>Not authenticated</div>;

  // 1️⃣ Luăm tenant_id din tenant_users
  const { data: tenantUsers, error: tuError } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id);

  if (tuError) {
    console.error("TENANT_USERS ERROR:", tuError);
    return <div>Eroare la încărcarea saloanelor</div>;
  }

  const tenantIds = tenantUsers?.map((t) => t.tenant_id) ?? [];
console.log("TENANT USERS:", tenantUsers);
console.log("TENANT IDS:", tenantIds);
  if (tenantIds.length === 0) {
    return <div>Nu ai niciun salon asociat.</div>;
  }

  // 2️⃣ AICI era greșeala: folosim id, NU tenant_id
  const { data: tenants, error: tenantsError } = await supabase
    .from("tenants")
    .select("id, name")
    .in("id", tenantIds);

  if (tenantsError) {
    console.error("TENANTS ERROR:", tenantsError);
    return <div>Eroare la încărcarea detaliilor salonului</div>;
  }

  // 3️⃣ Normalizăm ca SelectClient să primească tenant_id
  const formatted =
    tenants?.map((t) => ({
      tenant_id: t.id,
      name: t.name,
    })) ?? [];

 return <SelectClient tenants={formatted} />;
;}
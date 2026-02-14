// lib/supabase/getActiveTenant.ts
import { createSupabaseServerClient } from "./server";

export async function getActiveTenant() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("user_active_tenant")
    .select("tenant_id, tenants(name)")
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  return {
    tenant_id: data.tenant_id,
    // ✅ tenants ESTE ARRAY (Supabase FK)
    name: data.tenants?.[0]?.name ?? null,
  };
}

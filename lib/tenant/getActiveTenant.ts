import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getActiveTenant() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // 🔥 ia tenant din DB (NU din cookie)
  const { data: active } = await supabase
    .from("user_active_tenant")
    .select("tenant_id")
    .eq("user_id", user.id)
    .single();

  if (!active) return null;

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name")
    .eq("id", active.tenant_id)
    .single();

  if (!tenant) return null;

  return {
    tenant_id: tenant.id,
    name: tenant.name,
  };
}
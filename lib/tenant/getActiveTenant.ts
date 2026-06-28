import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROLE_PRIORITY: Record<string, number> = {
  owner: 0,
  manager: 1,
  barber: 2,
};

export async function getActiveTenant() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let tenantId: string | null = null;

  const { data: active } = await supabaseAdmin
    .from("user_active_tenant")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  tenantId = active?.tenant_id ?? null;

  if (!tenantId) {
    const { data: memberships } = await supabaseAdmin
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", user.id);

    const preferred = [...(memberships ?? [])].sort(
      (a, b) =>
        (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99)
    )[0];

    tenantId = preferred?.tenant_id ?? null;

    if (tenantId) {
      await supabase.from("user_active_tenant").upsert({
        user_id: user.id,
        tenant_id: tenantId,
      });
    }
  }

  if (!tenantId) {
    const { data: barber } = await supabaseAdmin
      .from("barbers")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    tenantId = barber?.tenant_id ?? null;
  }

  if (!tenantId) return null;

  const { data: tenant } = await supabaseAdmin
    .from("tenants")
    .select("id, name")
    .eq("id", tenantId)
    .single();

  if (!tenant) return null;

  return {
    tenant_id: tenant.id,
    name: tenant.name,
  };
}

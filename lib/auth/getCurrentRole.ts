import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ROLE_PRIORITY: Record<string, number> = {
  owner: 0,
  manager: 1,
  barber: 2,
};

export async function getCurrentRole() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // service_role: tenant_users RLS is circular via tenant_users_same_tenant
  const { data: memberships } = await supabaseAdmin
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", user.id);

  if (!memberships?.length) return null;

  const { data: activeTenant } = await supabase
    .from("user_active_tenant")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (activeTenant) {
    const match = memberships.find(
      (m) => m.tenant_id === activeTenant.tenant_id
    );
    if (match?.role) return match.role;
  }

  const preferred = [...memberships].sort(
    (a, b) =>
      (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99)
  )[0];

  await supabase.from("user_active_tenant").upsert({
    user_id: user.id,
    tenant_id: preferred.tenant_id,
  });

  return preferred.role;
}

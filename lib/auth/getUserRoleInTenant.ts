import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";

export type TenantRole = "owner" | "manager" | "barber";

export async function getUserRoleInTenant(): Promise<TenantRole | null> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const { data, error } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenant.tenant_id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return null;

  return data.role as TenantRole;
}
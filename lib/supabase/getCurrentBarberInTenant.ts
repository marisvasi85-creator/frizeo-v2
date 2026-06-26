import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";

export async function getCurrentBarberInTenant() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tenant = await getActiveTenant();

  if (tenant) {
    const { data } = await supabase
      .from("barbers")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant.tenant_id)
      .maybeSingle();

    if (data) return data;
  }

  const { data: fallback } = await supabase
    .from("barbers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!fallback) return null;

  await supabase.from("user_active_tenant").upsert({
    user_id: user.id,
    tenant_id: fallback.tenant_id,
  });

  return fallback;
}
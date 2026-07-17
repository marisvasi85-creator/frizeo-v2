import { cache } from "react";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const getCurrentBarberInTenant = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;

  const tenant = await getActiveTenant();

  if (tenant) {
    const { data } = await supabaseAdmin
      .from("barbers")
      .select("*")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant.tenant_id)
      .maybeSingle();

    if (data) return data;
  }

  const { data: fallback } = await supabaseAdmin
    .from("barbers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!fallback) return null;

  await supabaseAdmin.from("user_active_tenant").upsert({
    user_id: user.id,
    tenant_id: fallback.tenant_id,
  });

  return fallback;
});

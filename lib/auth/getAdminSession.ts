import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/auth/getAuthUser";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ROLE_PRIORITY: Record<string, number> = {
  owner: 0,
  manager: 1,
  barber: 2,
};

export type AdminBarber = {
  id: string;
  tenant_id: string;
  user_id: string | null;
  display_name: string | null;
  [key: string]: unknown;
};

export type AdminSession = {
  user: User;
  role: string | null;
  tenantId: string | null;
  tenantName: string | null;
  barber: AdminBarber | null;
};

/**
 * Single admin session lookup for layout / pages.
 * Deduped per request via React cache().
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createSupabaseServerClient();

  const [{ data: memberships }, { data: activeTenant }, { data: barbers }] =
    await Promise.all([
      supabaseAdmin
        .from("tenant_users")
        .select("tenant_id, role")
        .eq("user_id", user.id),
      supabaseAdmin
        .from("user_active_tenant")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabaseAdmin.from("barbers").select("*").eq("user_id", user.id),
    ]);

  let tenantId: string | null = activeTenant?.tenant_id ?? null;
  let role: string | null = null;

  if (memberships?.length) {
    if (tenantId) {
      role =
        memberships.find((m) => m.tenant_id === tenantId)?.role ?? null;
    }

    if (!tenantId || !role) {
      const preferred = [...memberships].sort(
        (a, b) =>
          (ROLE_PRIORITY[a.role] ?? 99) - (ROLE_PRIORITY[b.role] ?? 99),
      )[0];
      tenantId = preferred.tenant_id;
      role = preferred.role;

      await supabase.from("user_active_tenant").upsert({
        user_id: user.id,
        tenant_id: tenantId,
      });
    }
  }

  const userBarbers = (barbers ?? []) as AdminBarber[];
  let barber =
    (tenantId
      ? userBarbers.find((b) => b.tenant_id === tenantId)
      : undefined) ?? null;

  if (!tenantId && userBarbers[0]) {
    tenantId = userBarbers[0].tenant_id;
    barber = userBarbers[0];
    await supabaseAdmin.from("user_active_tenant").upsert({
      user_id: user.id,
      tenant_id: tenantId,
    });
  }

  if (!role && barber && tenantId && barber.tenant_id === tenantId) {
    role = "barber";
  }

  let tenantName: string | null = null;
  if (tenantId) {
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("id, name")
      .eq("id", tenantId)
      .maybeSingle();
    tenantName = tenant?.name ?? null;
  }

  return {
    user,
    role,
    tenantId,
    tenantName,
    barber,
  };
});

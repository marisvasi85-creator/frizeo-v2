import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import type { TenantRole } from "./getUserRoleInTenant";

export type TenantAuthContext = {
  user: User;
  tenantId: string;
  role: TenantRole;
  supabase: SupabaseClient;
};

export function isAuthError(
  result: TenantAuthContext | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

export async function requireTenantAccess(
  allowedRoles?: TenantRole[]
): Promise<TenantAuthContext | NextResponse> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getActiveTenant();

  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: membership, error } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenant.tenant_id)
    .eq("user_id", user.id)
    .single();

  if (error || !membership) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = membership.role as TenantRole;

  if (allowedRoles && !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    user,
    tenantId: tenant.tenant_id,
    role,
    supabase,
  };
}

export async function barberBelongsToTenant(
  supabase: SupabaseClient,
  barberId: string,
  tenantId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("barbers")
    .select("id")
    .eq("id", barberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return Boolean(data);
}

export async function serviceBelongsToTenant(
  supabase: SupabaseClient,
  serviceId: string,
  tenantId: string
): Promise<boolean> {
  const { data: service } = await supabase
    .from("barber_services")
    .select("barber_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (!service?.barber_id) return false;

  return barberBelongsToTenant(supabase, service.barber_id, tenantId);
}

export async function bookingAccessibleByUser(
  supabase: SupabaseClient,
  bookingId: string,
  tenantId: string,
  role: TenantRole,
  barberId: string | null
): Promise<boolean> {
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, tenant_id, barber_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking || booking.tenant_id !== tenantId) {
    return false;
  }

  if (role === "owner" || role === "manager") {
    return true;
  }

  return booking.barber_id === barberId;
}

export async function getCurrentBarberId(
  supabase: SupabaseClient,
  userId: string,
  tenantId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("barbers")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return data?.id ?? null;
}

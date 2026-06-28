import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
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

  const { data: membership } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("tenant_id", tenant.tenant_id)
    .eq("user_id", user.id)
    .maybeSingle();

  let role = membership?.role as TenantRole | undefined;

  if (!role) {
    const { data: barber } = await supabase
      .from("barbers")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant.tenant_id)
      .maybeSingle();

    if (barber) {
      role = "barber";
    }
  }

  if (!role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  serviceId: string,
  tenantId: string
): Promise<boolean> {
  const { data: service } = await supabaseAdmin
    .from("barber_services")
    .select("barber_id, tenant_id")
    .eq("id", serviceId)
    .maybeSingle();

  if (!service) return false;

  if (service.tenant_id && service.tenant_id !== tenantId) {
    return false;
  }

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select("id")
    .eq("id", service.barber_id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return Boolean(barber);
}

export async function assertServiceAccess(
  auth: TenantAuthContext,
  serviceId: string
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const allowed = await serviceBelongsToTenant(serviceId, auth.tenantId);

  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (auth.role === "barber") {
    const barberId = await getCurrentBarberId(
      auth.supabase,
      auth.user.id,
      auth.tenantId
    );

    const { data: service } = await supabaseAdmin
      .from("barber_services")
      .select("barber_id")
      .eq("id", serviceId)
      .maybeSingle();

    if (!service || service.barber_id !== barberId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return { ok: true };
}

export async function bookingAccessibleByUser(
  bookingId: string,
  tenantId: string,
  role: TenantRole,
  barberId: string | null
): Promise<boolean> {
  const { data: booking } = await supabaseAdmin
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

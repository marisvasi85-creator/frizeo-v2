import { NextResponse } from "next/server";
import {
  getCurrentBarberId,
  isAuthError,
  requireTenantAccess,
  type TenantAuthContext,
} from "@/lib/auth/requireTenantAccess";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ManagedBarberContext = {
  auth: TenantAuthContext;
  barber: {
    id: string;
    tenant_id: string;
    display_name: string | null;
    slug: string | null;
    booking_access_mode?: string | null;
  };
};

export async function requireManagedBarber(
  barberId: string,
): Promise<ManagedBarberContext | NextResponse> {
  const auth = await requireTenantAccess(["owner", "manager", "barber"]);
  if (isAuthError(auth)) return auth;

  const { data: barber, error } = await supabaseAdmin
    .from("barbers")
    .select("id, tenant_id, display_name, slug, booking_access_mode")
    .eq("id", barberId)
    .eq("tenant_id", auth.tenantId)
    .maybeSingle();

  if (error || !barber) {
    return NextResponse.json({ error: "Frizer inexistent." }, { status: 404 });
  }

  if (auth.role === "barber") {
    const ownBarberId = await getCurrentBarberId(auth.user.id, auth.tenantId);
    if (ownBarberId !== barberId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return { auth, barber };
}

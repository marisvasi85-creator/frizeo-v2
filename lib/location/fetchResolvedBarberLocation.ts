import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveBarberLocation } from "./resolveLocation";
import type { ResolvedLocation } from "./types";

export async function fetchResolvedBarberLocation(
  barberId: string,
  tenantId: string,
): Promise<ResolvedLocation | null> {
  const [{ data: tenant }, { data: barber }] = await Promise.all([
    supabaseAdmin.from("tenants").select("*").eq("id", tenantId).single(),
    supabaseAdmin.from("barbers").select("*").eq("id", barberId).single(),
  ]);

  if (!tenant || !barber) return null;

  return resolveBarberLocation(tenant, barber);
}

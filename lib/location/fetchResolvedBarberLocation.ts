import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveBarberLocation } from "./resolveLocation";
import type { ResolvedLocation } from "./types";

const TENANT_LOCATION_SELECT =
  "address, location_address_line, location_city, location_county, location_postal_code, location_maps_url, location_latitude, location_longitude";

const BARBER_LOCATION_SELECT =
  `use_salon_location, ${TENANT_LOCATION_SELECT}`;

export async function fetchResolvedBarberLocation(
  barberId: string,
  tenantId: string,
): Promise<ResolvedLocation | null> {
  const [{ data: tenant }, { data: barber }] = await Promise.all([
    supabaseAdmin
      .from("tenants")
      .select(TENANT_LOCATION_SELECT)
      .eq("id", tenantId)
      .single(),
    supabaseAdmin
      .from("barbers")
      .select(BARBER_LOCATION_SELECT)
      .eq("id", barberId)
      .single(),
  ]);

  if (!tenant || !barber) return null;

  return resolveBarberLocation(tenant, barber);
}

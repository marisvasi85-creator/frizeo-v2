import { createSupabaseServerClient } from "./server";
import { getActiveTenant } from "./getActiveTenant";

export async function getCurrentBarberInTenant() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const tenant = await getActiveTenant();
  if (!tenant) return null;

  const { data: barber, error } = await supabase
    .from("barbers")
    .select("*")
    .eq("user_id", user.id)
    .eq("tenant_id", tenant.tenant_id)
    .single();

  if (error || !barber) return null;

  return barber;
}

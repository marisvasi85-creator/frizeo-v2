"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/supabase/getActiveTenant";
import { revalidatePath } from "next/cache";

export async function updateServiceField(
  serviceId: string,
  field: string,
  value: any
) {
  const supabase = await createSupabaseServerClient();

  const tenant = await getActiveTenant();
  if (!tenant) return;

  await supabase
    .from("barber_services")
    .update({ [field]: value })
    .eq("id", serviceId)
    .eq("tenant_id", tenant.tenant_id);

  revalidatePath("/admin/services");
}
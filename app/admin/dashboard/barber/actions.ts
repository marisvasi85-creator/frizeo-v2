// app/admin/dashboard/barber/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleService(
  barberId: string,
  serviceId: string,
  active: boolean
) {
  const supabase = await createSupabaseServerClient();

  if (active) {
    await supabase.from("barber_services").upsert({
      barber_id: barberId,
      service_id: serviceId,
      active: true,
    });
  } else {
    await supabase
      .from("barber_services")
      .update({ active: false })
      .eq("barber_id", barberId)
      .eq("service_id", serviceId);
  }

  revalidatePath("/admin/dashboard/barber");
}

export async function updateService(
  barberServiceId: string,
  payload: {
    display_name?: string;
    price?: number;
    duration?: number;
  }
) {
  const supabase = await createSupabaseServerClient();

  await supabase
    .from("barber_services")
    .update(payload)
    .eq("id", barberServiceId);

  revalidatePath("/admin/dashboard/barber");
}

"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { revalidatePath } from "next/cache";

/* UPDATE */
export async function updateServiceField(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) return;

  const id = formData.get("id");
  const field = formData.get("field");
  const value = formData.get("value");

  await supabase
    .from("barber_services")
    .update({
      [field as string]:
        value === "true"
          ? true
          : value === "false"
          ? false
          : value,
    })
    .eq("id", id)
    .eq("barber_id", barber.id);

  revalidatePath("/admin/services");
}

/* DELETE */
export async function deleteService(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) return;

  const id = formData.get("id");

  await supabase
    .from("barber_services")
    .delete()
    .eq("id", id)
    .eq("barber_id", barber.id);

  revalidatePath("/admin/services");
}

/* CREATE (🔥 NOU) */
export async function createService(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) return;

  const name = formData.get("name") as string;
  const duration = Number(formData.get("duration"));
  const price = Number(formData.get("price"));

  await supabase.from("barber_services").insert({
    barber_id: barber.id,
    tenant_id: barber.tenant_id,
    name,
    duration,
    price,
    active: true,
    show_price: true,
    featured: false,
  });

  revalidatePath("/admin/services");
}
export async function updateServiceOrder(ids: string[]) {
  const supabase = await createSupabaseServerClient();
  const barber = await getCurrentBarberInTenant();

  if (!barber) return;

  const updates = ids.map((id, index) => ({
    id,
    sort_order: index,
  }));

  for (const item of updates) {
    await supabase
      .from("barber_services")
      .update({ sort_order: item.sort_order })
      .eq("id", item.id)
      .eq("barber_id", barber.id);
  }

  revalidatePath("/admin/services");
}
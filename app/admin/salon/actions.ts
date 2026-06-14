"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { revalidatePath } from "next/cache";

export async function updateSalon(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) return;

  const name = formData.get("name") as string;

  const slug = (formData.get("slug") as string)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

  await supabase
    .from("tenants")
    .update({
      name,
      slug,
    })
    .eq("id", barber.tenant_id);

  revalidatePath("/admin/salon");
}
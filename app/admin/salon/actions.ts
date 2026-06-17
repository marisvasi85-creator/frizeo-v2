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

  const phone =
    (formData.get("phone") as string) || null;

  const address =
    (formData.get("address") as string) || null;

  const description =
    (formData.get("description") as string) || null;

  const { data, error } = await supabase
    .from("tenants")
    .update({
      name,
      slug,
      phone,
      address,
      description,
    })
    .eq("id", barber.tenant_id)
    .select();

  console.log("UPDATE TENANT DATA:", data);
  console.log("UPDATE TENANT ERROR:", error);

  revalidatePath("/admin/salon");
}
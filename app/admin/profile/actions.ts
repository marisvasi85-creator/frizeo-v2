"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function updateProfile(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) return;

  const display_name =
    formData.get("display_name") as string;

  const phone =
    formData.get("phone") as string;

  const slug = (formData.get("slug") as string)
  .trim()
  .toLowerCase()
  .replace(/\s+/g, "-");
  
  const { data: existingSlug } = await supabase
  .from("barbers")
  .select("id")
  .eq("tenant_id", barber.tenant_id)
  .eq("slug", slug)
  .neq("id", barber.id)
  .maybeSingle();

if (existingSlug) {
  throw new Error(
    "Acest slug este deja folosit de alt frizer."
  );
}

  await supabase
    .from("barbers")
    .update({
      display_name,
      phone,
      slug,
    })
    .eq("id", barber.id);

  revalidatePath("/admin/profile");
} redirect("/admin/profile?saved=1");
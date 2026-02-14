"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createService(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const name = formData.get("name") as string;
  const duration = Number(formData.get("duration"));
  const price = Number(formData.get("price"));

  if (!name || !duration) {
    throw new Error("Date invalide");
  }

  const { data: tenant } = await supabase
    .from("user_active_tenant")
    .select("tenant_id")
    .single();

  if (!tenant) throw new Error("Tenant lipsă");

  const { error } = await supabase.from("services").insert({
    tenant_id: tenant.tenant_id,
    name,
    duration_minutes: duration,
    price,
  });

  if (error) throw error;

  revalidatePath("/admin/services");
}

export async function deleteService(id: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("services").delete().eq("id", id);

  if (error) throw error;

  revalidatePath("/admin/services");
}

/* ✅ NOU – toggle ON / OFF */
export async function toggleServiceActive(id: string, active: boolean) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/admin/services");
}

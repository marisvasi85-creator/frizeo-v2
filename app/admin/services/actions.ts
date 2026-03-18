"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant/getActiveTenant";
import { getUserRoleInTenant } from "@/lib/auth/getUserRoleInTenant";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/* =========================
   CREATE SERVICE
========================= */
export async function createService(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const tenant = await getActiveTenant();
  const role = await getUserRoleInTenant();

  if (!tenant?.tenant_id || !role) redirect("/select-tenant");
  if (role !== "owner" && role !== "manager")
    redirect("/admin/dashboard");

  const name = formData.get("name") as string;
  const duration = Number(formData.get("duration"));
  const price = Number(formData.get("price"));

  await supabase.from("services").insert({
    tenant_id: tenant.tenant_id,
    name,
    duration,
    price,
  });

  revalidatePath("/admin/services");
}

/* =========================
   DELETE SERVICE
========================= */
export async function deleteService(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const tenant = await getActiveTenant();
  const role = await getUserRoleInTenant();

  if (!tenant?.tenant_id || !role) redirect("/select-tenant");
  if (role !== "owner" && role !== "manager")
    redirect("/admin/dashboard");

  const id = formData.get("id") as string;

  await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id);

  revalidatePath("/admin/services");
}

/* =========================
   UPDATE SINGLE FIELD (inline edit)
========================= */
export async function updateServiceField(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const tenant = await getActiveTenant();
  const role = await getUserRoleInTenant();

  if (!tenant?.tenant_id || !role) redirect("/select-tenant");
  if (role !== "owner" && role !== "manager")
    redirect("/admin/dashboard");

  const id = formData.get("id") as string;
  const field = formData.get("field") as string;
  const value = formData.get("value");

  await supabase
    .from("services")
    .update({ [field]: value })
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id);

  revalidatePath("/admin/services");
}
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function updateServiceField(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const id = formData.get("id");
  const field = formData.get("field");
  const value = formData.get("value");

  await supabase
    .from("services")
    .update({
      [field as string]:
        value === "true"
          ? true
          : value === "false"
          ? false
          : value,
    })
    .eq("id", id);

  // 🔥 MAGICUL
  redirect("/admin/dashboard");
}
export async function deleteService(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const id = formData.get("id");

  await supabase.from("services").delete().eq("id", id);

  redirect("/admin/dashboard"); // 🔥
}
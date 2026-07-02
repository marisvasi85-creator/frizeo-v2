"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { revalidatePath } from "next/cache";
import { locationFieldsFromFormData } from "@/lib/location/resolveLocation";
import type { SaveFormState } from "../components/saveFormState";

export async function updateSalon(
  _prev: SaveFormState,
  formData: FormData
): Promise<SaveFormState> {
  try {
    const supabase = await createSupabaseServerClient();

    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return { success: false, error: "Nu ești autentificat." };
    }

    const name = formData.get("name") as string;

    const slug = (formData.get("slug") as string)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");

    const phone = (formData.get("phone") as string) || null;
    const description = (formData.get("description") as string) || null;
    const location = locationFieldsFromFormData(formData);

    const { error } = await supabase
      .from("tenants")
      .update({
        name,
        slug,
        phone,
        description,
        ...location,
      })
      .eq("id", barber.tenant_id);

    if (error) {
      return { success: false, error: "Nu s-a putut salva salonul." };
    }

    revalidatePath("/admin/salon");
    return { success: true };
  } catch {
    return { success: false, error: "Nu s-a putut salva salonul." };
  }
}

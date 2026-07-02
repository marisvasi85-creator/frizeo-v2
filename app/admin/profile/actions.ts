"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { revalidatePath } from "next/cache";
import { locationFieldsFromFormData } from "@/lib/location/resolveLocation";
import type { SaveFormState } from "../components/saveFormState";

export async function updateProfile(
  _prev: SaveFormState,
  formData: FormData
): Promise<SaveFormState> {
  try {
    const supabase = await createSupabaseServerClient();

    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return { success: false, error: "Nu ești autentificat." };
    }

    const display_name = formData.get("display_name") as string;
    const phone = formData.get("phone") as string;
    const bio = (formData.get("bio") as string) || null;
    const instagram_url = (formData.get("instagram_url") as string) || null;

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
      return {
        success: false,
        error: "Acest slug este deja folosit de alt frizer.",
      };
    }

    const useSalonLocation =
      (formData.get("use_salon_location") as string) === "true";
    const location = locationFieldsFromFormData(formData);

    const { error } = await supabase
      .from("barbers")
      .update({
        display_name,
        phone,
        slug,
        bio,
        instagram_url,
        use_salon_location: useSalonLocation,
        ...(useSalonLocation
          ? {
              location_address_line: null,
              location_city: null,
              location_county: null,
              location_postal_code: null,
              location_maps_url: null,
              location_latitude: null,
              location_longitude: null,
            }
          : location),
      })
      .eq("id", barber.id);

    if (error) {
      return { success: false, error: "Nu s-a putut salva profilul." };
    }

    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Nu s-a putut salva profilul." };
  }
}

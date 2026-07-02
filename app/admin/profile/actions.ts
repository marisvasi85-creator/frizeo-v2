"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  hasLocationMigration,
  locationMigrationErrorMessage,
} from "@/lib/location/hasLocationMigration";
import { locationFieldsFromFormData } from "@/lib/location/resolveLocation";
import type { SaveFormState } from "../components/saveFormState";

function isMissingLocationColumnError(message?: string) {
  return (
    !!message &&
    (message.includes("location_") ||
      message.includes("use_salon_location") ||
      message.includes("schema cache") ||
      message.includes("column"))
  );
}

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

    const locationReady = await hasLocationMigration();
    const useSalonLocation =
      (formData.get("use_salon_location") as string) === "true";
    const location = locationReady ? locationFieldsFromFormData(formData) : {};

    const updatePayload: Record<string, unknown> = {
      display_name,
      phone,
      slug,
      bio,
      instagram_url,
    };

    if (locationReady) {
      Object.assign(updatePayload, {
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
      });
    }

    const { data, error } = await supabaseAdmin
      .from("barbers")
      .update(updatePayload)
      .eq("id", barber.id)
      .select("id")
      .single();

    if (error) {
      if (isMissingLocationColumnError(error.message)) {
        return {
          success: false,
          error: locationMigrationErrorMessage(),
        };
      }

      console.error("UPDATE PROFILE:", error);
      return { success: false, error: "Nu s-a putut salva profilul." };
    }

    if (!data) {
      return { success: false, error: "Nu s-a putut salva profilul." };
    }

    revalidatePath("/admin/profile");
    return { success: true };
  } catch (err) {
    console.error("UPDATE PROFILE:", err);
    return { success: false, error: "Nu s-a putut salva profilul." };
  }
}

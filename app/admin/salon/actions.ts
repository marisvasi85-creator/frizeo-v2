"use server";

import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  hasLocationMigration,
  locationMigrationErrorMessage,
} from "@/lib/location/hasLocationMigration";
import { locationFieldsFromFormData } from "@/lib/location/resolveLocation";
import {
  directoryMigrationErrorMessage,
  hasDirectoryListedMigration,
} from "@/lib/seo/hasDirectoryListedMigration";
import { cityToSlug } from "@/lib/seo/citySlug";
import type { SaveFormState } from "../components/saveFormState";

function isMissingColumnError(message?: string) {
  return (
    !!message &&
    (message.includes("location_") ||
      message.includes("directory_listed") ||
      message.includes("schema cache") ||
      message.includes("column"))
  );
}

export async function updateSalon(
  _prev: SaveFormState,
  formData: FormData
): Promise<SaveFormState> {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return { success: false, error: "Nu ești autentificat." };
    }

    const role = await getCurrentRole();

    if (role !== "owner") {
      return {
        success: false,
        error: "Doar proprietarul salonului poate modifica aceste date.",
      };
    }

    const name = formData.get("name") as string;

    const phone = (formData.get("phone") as string) || null;
    const description = (formData.get("description") as string) || null;
    const locationReady = await hasLocationMigration();
    const location = locationReady
      ? locationFieldsFromFormData(formData)
      : {
          address:
            (formData.get("location_address_line") as string)?.trim() || null,
        };

    const directoryReady = await hasDirectoryListedMigration();
    const directoryPayload = directoryReady
      ? { directory_listed: formData.get("directory_listed") === "on" }
      : {};

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .update({
        name,
        phone,
        description,
        ...location,
        ...directoryPayload,
      })
      .eq("id", barber.tenant_id)
      .select("id")
      .single();

    if (error) {
      if (isMissingColumnError(error.message)) {
        if (error.message.includes("directory_listed")) {
          return {
            success: false,
            error: directoryMigrationErrorMessage(),
          };
        }
        return {
          success: false,
          error: locationMigrationErrorMessage(),
        };
      }

      console.error("UPDATE SALON:", error);
      return { success: false, error: "Nu s-a putut salva salonul." };
    }

    if (!data) {
      return { success: false, error: "Nu s-a putut salva salonul." };
    }

    revalidatePath("/admin/salon");
    revalidatePath("/frizerii");

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("slug, location_city")
      .eq("id", barber.tenant_id)
      .single();

    if (tenant?.slug) {
      revalidatePath(`/booking/salon/${tenant.slug}`);
    }

    const citySlug = tenant?.location_city
      ? cityToSlug(tenant.location_city)
      : "";
    if (citySlug) {
      revalidatePath(`/frizerii/${citySlug}`);
    }

    return { success: true };
  } catch (err) {
    console.error("UPDATE SALON:", err);
    return { success: false, error: "Nu s-a putut salva salonul." };
  }
}

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
import type { SaveFormState } from "../components/saveFormState";

function isMissingLocationColumnError(message?: string) {
  return (
    !!message &&
    (message.includes("location_") ||
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
          address: (formData.get("location_address_line") as string)?.trim() || null,
        };

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .update({
        name,
        phone,
        description,
        ...location,
      })
      .eq("id", barber.tenant_id)
      .select("id")
      .single();

    if (error) {
      if (isMissingLocationColumnError(error.message)) {
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

    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("slug")
      .eq("id", barber.tenant_id)
      .single();

    if (tenant?.slug) {
      revalidatePath(`/booking/salon/${tenant.slug}`);
    }

    return { success: true };
  } catch (err) {
    console.error("UPDATE SALON:", err);
    return { success: false, error: "Nu s-a putut salva salonul." };
  }
}

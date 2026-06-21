"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import type { SaveFormState } from "../components/saveFormState";

export async function updateNotifications(
  _prev: SaveFormState,
  formData: FormData
): Promise<SaveFormState> {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return { success: false, error: "Nu ești autentificat." };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("notification_settings").upsert({
      tenant_id: barber.tenant_id,
      booking_email_enabled: formData.get("booking_email_enabled") === "on",
      booking_sms_enabled: formData.get("booking_sms_enabled") === "on",
      reminder_email_enabled: formData.get("reminder_email_enabled") === "on",
      reminder_sms_enabled: formData.get("reminder_sms_enabled") === "on",
      reschedule_email_enabled:
        formData.get("reschedule_email_enabled") === "on",
      reschedule_sms_enabled: formData.get("reschedule_sms_enabled") === "on",
      cancel_email_enabled: formData.get("cancel_email_enabled") === "on",
      cancel_sms_enabled: formData.get("cancel_sms_enabled") === "on",
    });

    if (error) {
      return { success: false, error: "Nu s-au putut salva notificările." };
    }

    revalidatePath("/admin/notifications");
    return { success: true };
  } catch {
    return { success: false, error: "Nu s-au putut salva notificările." };
  }
}

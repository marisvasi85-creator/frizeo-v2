"use server";

import { revalidatePath } from "next/cache";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentPlan } from "@/lib/billing/getCurrentPlan";
import { planAllowsSms } from "@/lib/billing/plans";
import type { SaveFormState } from "../components/saveFormState";

function smsField(
  formData: FormData,
  name: string,
  allowed: boolean
): boolean {
  if (!allowed) return false;
  return formData.get(name) === "on";
}

export async function updateNotifications(
  _prev: SaveFormState,
  formData: FormData
): Promise<SaveFormState> {
  try {
    const barber = await getCurrentBarberInTenant();

    if (!barber) {
      return { success: false, error: "Nu ești autentificat." };
    }

    const plan = await getCurrentPlan(barber.tenant_id);
    const smsAllowed = planAllowsSms(plan);

    const { error } = await supabaseAdmin.from("notification_settings").upsert(
      {
        tenant_id: barber.tenant_id,
        booking_email_enabled: formData.get("booking_email_enabled") === "on",
        booking_sms_enabled: smsField(formData, "booking_sms_enabled", smsAllowed),
        reminder_email_enabled: formData.get("reminder_email_enabled") === "on",
        reminder_sms_enabled: smsField(formData, "reminder_sms_enabled", smsAllowed),
        reschedule_email_enabled:
          formData.get("reschedule_email_enabled") === "on",
        reschedule_sms_enabled: smsField(
          formData,
          "reschedule_sms_enabled",
          smsAllowed
        ),
        cancel_email_enabled: formData.get("cancel_email_enabled") === "on",
        cancel_sms_enabled: smsField(formData, "cancel_sms_enabled", smsAllowed),
      },
      { onConflict: "tenant_id" }
    );

    if (error) {
      console.error("updateNotifications:", error);
      return { success: false, error: "Nu s-au putut salva notificările." };
    }

    revalidatePath("/admin/notifications");
    return { success: true };
  } catch {
    return { success: false, error: "Nu s-au putut salva notificările." };
  }
}

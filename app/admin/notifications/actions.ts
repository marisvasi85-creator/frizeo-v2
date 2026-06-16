"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export async function updateNotifications(
  formData: FormData
) {
  const barber =
    await getCurrentBarberInTenant();

  if (!barber) return;

  const supabase =
    await createSupabaseServerClient();

  await supabase
    .from("notification_settings")
    .upsert({
      tenant_id: barber.tenant_id,

      booking_email_enabled:
        formData.get("booking_email_enabled") === "on",

      booking_sms_enabled:
        formData.get("booking_sms_enabled") === "on",

      reminder_email_enabled:
        formData.get("reminder_email_enabled") === "on",

      reminder_sms_enabled:
        formData.get("reminder_sms_enabled") === "on",

      reschedule_email_enabled:
        formData.get("reschedule_email_enabled") === "on",

      reschedule_sms_enabled:
        formData.get("reschedule_sms_enabled") === "on",

      cancel_email_enabled:
        formData.get("cancel_email_enabled") === "on",

      cancel_sms_enabled:
        formData.get("cancel_sms_enabled") === "on",
    });

  revalidatePath(
    "/admin/notifications"
  );
}
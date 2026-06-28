import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getNotificationSettings(tenantId: string) {
  const { data } = await supabaseAdmin
    .from("notification_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  return data;
}

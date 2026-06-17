import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getNotificationSettings(
  tenantId: string
) {
  const supabase =
    await createSupabaseServerClient();

  const { data } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  return data;
}
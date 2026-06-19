import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentRole() {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: activeTenant } =
    await supabase
      .from("user_active_tenant")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

  if (!activeTenant) {
    return null;
  }

  const { data } =
    await supabase
      .from("tenant_users")
      .select("role")
      .eq("user_id", user.id)
      .eq(
        "tenant_id",
        activeTenant.tenant_id
      )
      .single();

  return data?.role ?? null;
}
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentRole() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("tenant_users")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return data?.role ?? null;
}
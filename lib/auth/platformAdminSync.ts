import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Ensure allowlisted platform admins have a DB row for RLS (is_platform_admin()).
 * Idempotent upsert via service role — never call from the browser.
 */
export async function syncPlatformAdminMembership(input: {
  userId: string;
  email: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.userId) return;

  const { error } = await supabaseAdmin.from("platform_admins").upsert(
    {
      user_id: input.userId,
      email,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[platform_admins] sync failed:", error.message);
  }
}

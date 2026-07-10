import { supabaseAdmin } from "@/lib/supabase/admin";

let cached: boolean | null = null;

export async function hasSocialLinksMigration(): Promise<boolean> {
  if (cached !== null) return cached;

  const { error } = await supabaseAdmin
    .from("barbers")
    .select("facebook_url, tiktok_url")
    .limit(1);

  cached = !error;
  return cached;
}

export function socialLinksMigrationMessage(): string {
  return "Rulează migrarea supabase/migrations/20260710_barber_social_links.sql în Supabase SQL Editor pentru câmpurile Facebook și TikTok.";
}

import { supabaseAdmin } from "@/lib/supabase/admin";

let cached: boolean | null = null;

export async function hasLocationMigration(): Promise<boolean> {
  if (cached !== null) return cached;

  const { error } = await supabaseAdmin
    .from("tenants")
    .select("location_address_line")
    .limit(1);

  cached = !error;
  return cached;
}

export function locationMigrationErrorMessage(): string {
  return "Migrarea pentru locație lipsește în baza de date. Rulează supabase/migrations/20260703_location_fields.sql în Supabase SQL Editor, apoi reîncearcă.";
}

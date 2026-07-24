import { supabaseAdmin } from "@/lib/supabase/admin";

let cached: boolean | null = null;

/** True when tenants.directory_listed exists (migration applied). */
export async function hasDirectoryListedMigration(): Promise<boolean> {
  if (cached !== null) return cached;

  const { error } = await supabaseAdmin
    .from("tenants")
    .select("directory_listed")
    .limit(1);

  cached = !error;
  return cached;
}

export function directoryMigrationErrorMessage() {
  return "Migrarea pentru directorul local (directory_listed) nu e aplicată în baza de date.";
}

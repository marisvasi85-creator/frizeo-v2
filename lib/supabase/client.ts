import { createBrowserClient } from "@supabase/ssr";
import { getAuthCookieOptions } from "@/lib/supabase/cookieOptions";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookieOptions: getAuthCookieOptions(),
  });
}

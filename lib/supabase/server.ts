import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { hostnameFromHeaderStore } from "@/lib/app/environment";
import { getAuthCookieOptions } from "@/lib/supabase/cookieOptions";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  let hostname = "";
  try {
    hostname = hostnameFromHeaderStore(await headers());
  } catch {
    hostname = "";
  }

  return createServerClient(
    getSupabaseUrl(hostname),
    getSupabaseAnonKey(hostname),
    {
      cookieOptions: getAuthCookieOptions(hostname),
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

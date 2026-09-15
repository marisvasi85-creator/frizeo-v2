import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { hostnameFromHeaderStore } from "@/lib/app/environment";
import { getAuthCookieOptions } from "@/lib/supabase/cookieOptions";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  let hostname = "";
  try {
    hostname = hostnameFromHeaderStore(await headers());
  } catch {
    hostname = "";
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

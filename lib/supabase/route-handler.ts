import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { hostnameFromHeaderStore } from "@/lib/app/environment";
import { getAuthCookieOptions } from "@/lib/supabase/cookieOptions";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";

/**
 * Supabase client for Route Handlers that attaches session cookies to the
 * outgoing NextResponse (required for browsers to persist auth on mobile).
 */
export async function createSupabaseRouteHandlerClient(
  buildResponse: () => NextResponse = () => NextResponse.next()
) {
  const cookieStore = await cookies();
  const response = buildResponse();
  let hostname = "";
  try {
    hostname = hostnameFromHeaderStore(await headers());
  } catch {
    hostname = "";
  }

  const supabase = createServerClient(
    getSupabaseUrl(hostname),
    getSupabaseAnonKey(hostname),
    {
      cookieOptions: getAuthCookieOptions(hostname),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  return { supabase, getResponse: () => response };
}

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

/**
 * Supabase client for Route Handlers that attaches session cookies to the
 * outgoing NextResponse (required for browsers to persist auth on mobile).
 */
export async function createSupabaseRouteHandlerClient(
  buildResponse: () => NextResponse = () => NextResponse.next()
) {
  const cookieStore = await cookies();
  let response = buildResponse();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

import { createServerClient } from "@supabase/ssr";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { hostnameFromRequest } from "@/lib/app/environment";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/config";
import { getAuthCookieOptions } from "@/lib/supabase/cookieOptions";

export async function POST(request: NextRequest) {
  let response = NextResponse.redirect(new URL("/login", request.url), {
    status: 302,
  });
  const hostname = hostnameFromRequest(request);

  const supabase = createServerClient(
    getSupabaseUrl(hostname),
    getSupabaseAnonKey(hostname),
    {
      cookieOptions: getAuthCookieOptions(hostname),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.redirect(new URL("/login", request.url), {
            status: 302,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  await supabase.auth.signOut();
  revalidatePath("/", "layout");

  return response;
}

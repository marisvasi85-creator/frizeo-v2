import { NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/admin/dashboard";

  if (!next.startsWith("/")) {
    next = "/admin/dashboard";
  }

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }

  const { supabase, getResponse } = await createSupabaseRouteHandlerClient(() =>
    NextResponse.redirect(new URL(next, origin))
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth", origin));
  }

  return getResponse();
}

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getEmailAppUrl, getFrizeoAppUrl } from "@/lib/frizeo-email/config";

/**
 * Start SSO handoff: www.frizeo.ro → email.frizeo.ro
 * Uses a one-time Supabase magiclink hash (no email sent).
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    const login = new URL("/login", getFrizeoAppUrl());
    login.searchParams.set("next", "/api/email/sso");
    return NextResponse.redirect(login);
  }

  const emailAppUrl = getEmailAppUrl();

  // Same-origin path mode (local/preview): no token exchange needed.
  if (emailAppUrl.includes("/email")) {
    return NextResponse.redirect(new URL(emailAppUrl));
  }

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: auth.email,
    options: {
      redirectTo: `${emailAppUrl}/`,
    },
  });

  if (error || !data.properties?.hashed_token) {
    console.error("[email-sso] generateLink failed:", error?.message);
    return NextResponse.redirect(new URL("/admin/dashboard?email_sso=error", getFrizeoAppUrl()));
  }

  const callback = new URL("/api/email/sso/callback", emailAppUrl);
  callback.searchParams.set("token_hash", data.properties.hashed_token);
  callback.searchParams.set("type", "email");
  callback.searchParams.set("next", "/");

  return NextResponse.redirect(callback);
}

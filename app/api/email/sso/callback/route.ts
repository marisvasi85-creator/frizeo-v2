import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler";
import { isPlatformAdminEmail } from "@/lib/auth/requirePlatformAdmin";
import { syncPlatformAdminMembership } from "@/lib/auth/platformAdminSync";
import { getEmailAppUrl, getFrizeoAppUrl } from "@/lib/frizeo-email/config";

/**
 * Complete SSO on email.frizeo.ro by verifying the one-time token hash.
 */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") || "email";
  const nextPath = req.nextUrl.searchParams.get("next") || "/";

  const emailAppUrl = getEmailAppUrl();
  const frizeoUrl = getFrizeoAppUrl();

  if (!tokenHash) {
    return NextResponse.redirect(new URL("/login", frizeoUrl));
  }

  const safeNext =
    nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";

  const { supabase, getResponse } = await createSupabaseRouteHandlerClient(
    () => NextResponse.redirect(new URL(safeNext, emailAppUrl)),
  );

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type === "magiclink" ? "email" : (type as "email"),
  });

  if (error || !data.user) {
    console.error("[email-sso] verifyOtp failed:", error?.message);
    return NextResponse.redirect(new URL("/login?error=email_sso", frizeoUrl));
  }

  if (!isPlatformAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/admin/dashboard", frizeoUrl));
  }

  await syncPlatformAdminMembership({
    userId: data.user.id,
    email: data.user.email!.trim().toLowerCase(),
  });

  return getResponse();
}

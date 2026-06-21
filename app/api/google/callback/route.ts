import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

function redirectToProfile(
  appUrl: string,
  params?: Record<string, string>
) {
  const url = new URL(`${appUrl}/admin/profile`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");

  if (oauthError) {
    return redirectToProfile(appUrl, { google: oauthError });
  }

  if (!code) {
    return redirectToProfile(appUrl, { google: "missing_code" });
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${appUrl}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.access_token) {
    console.error("GOOGLE TOKEN ERROR:", tokenData);
    return redirectToProfile(appUrl, { google: "token_error" });
  }

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    return redirectToProfile(appUrl, { google: "no_barber" });
  }

  let googleEmail: string | null = null;

  const googleUserRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    }
  );

  if (googleUserRes.ok) {
    const googleUser = await googleUserRes.json();
    googleEmail = googleUser.email ?? null;
  }

  const { data: existingAccount } = await supabaseAdmin
    .from("barber_google_accounts")
    .select("refresh_token")
    .eq("barber_id", barber.id)
    .maybeSingle();

  const refreshToken =
    tokenData.refresh_token || existingAccount?.refresh_token || null;

  if (!refreshToken) {
    console.error(
      "GOOGLE: no refresh_token — user may need to revoke app access in Google Account and reconnect"
    );
    return redirectToProfile(appUrl, { google: "no_refresh_token" });
  }

  const { error: upsertError } = await supabaseAdmin
    .from("barber_google_accounts")
    .upsert(
      {
        barber_id: barber.id,
        google_email: googleEmail,
        access_token: tokenData.access_token,
        refresh_token: refreshToken,
        expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        ).toISOString(),
        calendar_id: "primary",
      },
      { onConflict: "barber_id" }
    );

  if (upsertError) {
    console.error("GOOGLE UPSERT ERROR:", upsertError);
    return redirectToProfile(appUrl, { google: "save_error" });
  }

  const { error: barberUpdateError } = await supabaseAdmin
    .from("barbers")
    .update({ google_calendar_connected: true })
    .eq("id", barber.id);

  if (barberUpdateError) {
    console.error("GOOGLE BARBER UPDATE ERROR:", barberUpdateError);
  }

  return redirectToProfile(appUrl, { google: "connected" });
}

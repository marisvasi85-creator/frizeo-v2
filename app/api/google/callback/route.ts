import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/profile`
    );
  }

  const tokenRes = await fetch(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret:
          process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:
          `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
        grant_type: "authorization_code",
      }),
    }
  );

  const tokenData = await tokenRes.json();

  const supabase =
    await createSupabaseServerClient();

  const barber =
    await getCurrentBarberInTenant();

  if (!barber) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/profile`
    );
  }

  await supabase
    .from("barbers")
    .update({
      google_calendar_connected: true,
      google_access_token:
        tokenData.access_token,
      google_refresh_token:
        tokenData.refresh_token,
      google_token_expires_at: new Date(
        Date.now() +
          tokenData.expires_in * 1000
      ).toISOString(),
      google_calendar_id: "primary",
    })
    .eq("id", barber.id);

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/admin/profile`
  );
}
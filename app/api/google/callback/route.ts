import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export async function GET(req: NextRequest) {
  console.log(
  "CALLBACK URL:",
  req.nextUrl.toString()
);

console.log(
  "CODE:",
  req.nextUrl.searchParams.get("code")
);
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
console.log("TOKEN DATA:", tokenData);
  const supabase =
    await createSupabaseServerClient();

  const barber =
    await getCurrentBarberInTenant();
console.log("BARBER:", barber);
  if (!barber) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/admin/profile`
    );
  }

  const googleUserRes = await fetch(
  "https://www.googleapis.com/oauth2/v2/userinfo",
  {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  }
);

const googleUser = await googleUserRes.json();
console.log("GOOGLE USER:", googleUser);
const { error } = await supabase
  .from("barber_google_accounts")
  .upsert({
    barber_id: barber.id,
    google_email: googleUser.email,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_at: new Date(
      Date.now() + tokenData.expires_in * 1000
    ).toISOString(),
    calendar_id: "primary",
  });

if (error) {
  console.error("GOOGLE UPSERT ERROR:", error);
}

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/admin/profile`
  );
}
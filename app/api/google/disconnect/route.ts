import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app/getAppUrl";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { revokeGoogleOAuthToken } from "@/lib/google/revokeToken";

function redirectToProfile(params?: Record<string, string>) {
  const url = new URL(`${getAppUrl()}/admin/profile`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }
  return NextResponse.redirect(url.toString());
}

export async function POST() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    return redirectToProfile({ google: "no_barber" });
  }

  const { data: googleAccount } = await supabaseAdmin
    .from("barber_google_accounts")
    .select("refresh_token, access_token")
    .eq("barber_id", barber.id)
    .maybeSingle();

  const tokenToRevoke =
    googleAccount?.refresh_token ?? googleAccount?.access_token ?? null;

  if (tokenToRevoke) {
    await revokeGoogleOAuthToken(tokenToRevoke);
  }

  await supabaseAdmin
    .from("barber_google_accounts")
    .delete()
    .eq("barber_id", barber.id);

  await supabaseAdmin
    .from("barbers")
    .update({ google_calendar_connected: false })
    .eq("id", barber.id);

  return redirectToProfile({ google: "disconnected" });
}

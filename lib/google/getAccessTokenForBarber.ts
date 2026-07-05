import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshAccessToken } from "@/lib/google/refreshAccessToken";

export async function getAccessTokenForBarber(
  supabase: SupabaseClient,
  barberId: string,
): Promise<{ accessToken: string; calendarId: string } | null> {
  const { data: googleAccount } = await supabase
    .from("barber_google_accounts")
    .select("*")
    .eq("barber_id", barberId)
    .maybeSingle();

  if (!googleAccount?.access_token && !googleAccount?.refresh_token) {
    return null;
  }

  let accessToken = googleAccount.access_token;

  const expiresAt = googleAccount.expires_at
    ? new Date(googleAccount.expires_at).getTime()
    : 0;
  const shouldRefresh =
    !!googleAccount.refresh_token &&
    (!accessToken || expiresAt < Date.now() + 5 * 60 * 1000);

  if (shouldRefresh) {
    const refreshed = await refreshAccessToken(googleAccount.refresh_token!);

    if (!refreshed?.access_token) {
      console.error("GOOGLE REFRESH ERROR: no access_token for barber", barberId);
      return null;
    }

    accessToken = refreshed.access_token;

    await supabase
      .from("barber_google_accounts")
      .update({
        access_token: refreshed.access_token,
        expires_at: new Date(
          Date.now() + refreshed.expires_in * 1000,
        ).toISOString(),
      })
      .eq("barber_id", barberId);
  }

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    calendarId: googleAccount.calendar_id || "primary",
  };
}

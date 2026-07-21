import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { updateProfile } from "./actions";
import AvatarUpload from "./AvatarUpload";
import FormWithSaveFeedback from "../components/FormWithSaveFeedback";
import BarberLocationSection from "@/app/components/location/BarberLocationSection";
import GoogleCalendarConnectDisclosure from "./GoogleCalendarConnectDisclosure";
import GoogleCalendarSyncButton from "./GoogleCalendarSyncButton";
import { formatLocationAddress } from "@/lib/location/resolveLocation";

const GOOGLE_MESSAGES: Record<string, string> = {
  connected: "Google Calendar a fost conectat cu succes.",
  disconnected: "Google Calendar a fost deconectat. Poți reconecta oricând din Profil.",
  token_error:
    "Nu am putut obține accesul de la Google. Verifică credențialele OAuth în Vercel.",
  no_barber:
    "Nu am găsit profilul de frizer pentru contul curent. Încearcă să te reconectezi.",
  no_refresh_token:
    "Google nu a trimis token de reînnoire. Revocă accesul Frizeo din contul Google (myaccount.google.com/permissions) și conectează din nou.",
  save_error:
    "Nu am putut salva conexiunea. Contactează suportul dacă problema persistă.",
  missing_code: "Conectarea a fost anulată sau linkul a expirat.",
  access_denied:
    "Conectarea la Google Calendar a fost refuzată sau contul tău nu este încă autorizat. Contactează suportul la info@frizeo.ro cu adresa de Gmail folosită.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { google: googleStatus } = await searchParams;
  const [session, barber] = await Promise.all([
    getAdminSession(),
    getCurrentBarberInTenant(),
  ]);

  if (!session?.user || !barber) {
    redirect("/login");
  }

  const [googleAccountRes, tenantRes] = await Promise.all([
    supabase
      .from("barber_google_accounts")
      .select("google_email, refresh_token")
      .eq("barber_id", barber.id)
      .maybeSingle(),
    supabase
      .from("tenants")
      .select(
        `
      address,
      location_address_line,
      location_city,
      location_county,
      location_postal_code,
      location_maps_url,
      location_latitude,
      location_longitude
    `,
      )
      .eq("id", barber.tenant_id)
      .single(),
  ]);

  const googleAccount = googleAccountRes.data;
  const tenant = tenantRes.data;

  const isConnected =
    !!googleAccount?.refresh_token || !!barber.google_calendar_connected;

  const statusMessage = googleStatus
    ? GOOGLE_MESSAGES[googleStatus] ||
      `Eroare la conectare (${googleStatus}).`
    : null;

  const isSuccess =
    googleStatus === "connected" || googleStatus === "disconnected";

  const salonPreview = tenant ? formatLocationAddress(tenant) : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Profil</h1>

      {statusMessage && (
        <div
          className={`rounded-xl p-4 text-sm ${
            isSuccess
              ? "bg-green-500/10 border border-green-500/30 text-green-300"
              : "bg-red-500/10 border border-red-500/30 text-red-300"
          }`}
        >
          {statusMessage}
        </div>
      )}

      <div className="bg-[#161618] border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Google Calendar</h2>

        {isConnected ? (
          <div className="space-y-4">
            <div>
              <p className="text-green-400">Calendar conectat</p>
              {googleAccount?.google_email && (
                <p className="text-sm text-white/50 mt-1">
                  {googleAccount.google_email}
                </p>
              )}
            </div>

            <GoogleCalendarSyncButton />

            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="/api/google/connect"
                className="px-4 py-2 bg-white/10 rounded-lg text-center text-sm"
              >
                Reconectează
              </a>

              <form action="/api/google/disconnect" method="post">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 rounded-lg text-center text-sm border border-red-500/40 text-red-300 hover:bg-red-500/10"
                >
                  Deconectează Calendar
                </button>
              </form>
            </div>

            <p className="text-xs text-white/40">
              Poți revoca accesul și din{" "}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                contul Google
              </a>
              .{" "}
              <a href="/google-calendar-data" className="underline">
                Detalii prelucrare date
              </a>
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-white/60">
              Opțional — programările confirmate pot apărea automat în Google
              Calendar. Frizeo funcționează normal și fără această conexiune.
            </p>

            <GoogleCalendarConnectDisclosure />

            <a
              href="/api/google/connect"
              className="inline-block px-4 py-2 bg-white text-black rounded-lg font-medium text-center text-sm"
            >
              Conectează Google Calendar
            </a>
          </div>
        )}
      </div>

      <AvatarUpload currentUrl={barber.avatar_url} />

      <FormWithSaveFeedback
        action={updateProfile}
        className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-5"
      >
        <div>
          <label className="block text-sm text-white/60 mb-2">
            Nume afișat
          </label>

          <input
            type="text"
            name="display_name"
            defaultValue={barber.display_name || ""}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Telefon</label>

          <input
            type="text"
            name="phone"
            defaultValue={barber.phone || ""}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Link programări
          </label>

          <p className="text-xs text-white/40">
            Linkul permanent nu se schimbă când îți actualizezi numele. Îl poți
            trimite clienților fără griji.
          </p>

          <p className="mt-2 text-sm text-white/50 font-mono break-all">
            /booking/{barber.id}
          </p>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Rețele sociale
          </label>
          <p className="text-xs text-white/40 mb-3">
            Linkurile apar în Marketing AI și pe pagina ta publică de programări.
          </p>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Instagram</label>

          <input
            type="url"
            name="instagram_url"
            defaultValue={barber.instagram_url || ""}
            placeholder="https://instagram.com/..."
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Facebook</label>

          <input
            type="url"
            name="facebook_url"
            defaultValue={barber.facebook_url || ""}
            placeholder="https://facebook.com/..."
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">TikTok</label>

          <input
            type="url"
            name="tiktok_url"
            defaultValue={barber.tiktok_url || ""}
            placeholder="https://tiktok.com/@..."
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Descriere / Bio
          </label>

          <textarea
            name="bio"
            rows={5}
            defaultValue={barber.bio || ""}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <BarberLocationSection
          useSalonLocation={barber.use_salon_location !== false}
          salonPreview={salonPreview}
          defaults={barber}
        />

      </FormWithSaveFeedback>
    </div>
  );
}

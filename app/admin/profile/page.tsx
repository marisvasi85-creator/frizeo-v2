import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { updateProfile } from "./actions";
import AvatarUpload from "./AvatarUpload";
import FormWithSaveFeedback from "../components/FormWithSaveFeedback";

const GOOGLE_MESSAGES: Record<string, string> = {
  connected: "Google Calendar a fost conectat cu succes.",
  token_error:
    "Nu am putut obține accesul de la Google. Verifică credențialele OAuth în Vercel.",
  no_barber:
    "Nu am găsit profilul de frizer pentru contul curent. Încearcă să te reconectezi.",
  no_refresh_token:
    "Google nu a trimis token de reînnoire. Revocă accesul Frizeo din contul Google (myaccount.google.com/permissions) și conectează din nou.",
  save_error:
    "Nu am putut salva conexiunea. Contactează suportul dacă problema persistă.",
  missing_code: "Conectarea a fost anulată sau linkul a expirat.",
  access_denied: "Ai refuzat accesul la Google Calendar.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { google: googleStatus } = await searchParams;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  const { data: googleAccount } = await supabase
    .from("barber_google_accounts")
    .select("google_email, refresh_token")
    .eq("barber_id", barber.id)
    .maybeSingle();

  const isConnected =
    !!googleAccount?.refresh_token || !!barber.google_calendar_connected;

  const statusMessage = googleStatus
    ? GOOGLE_MESSAGES[googleStatus] ||
      `Eroare la conectare (${googleStatus}).`
    : null;

  const isSuccess = googleStatus === "connected";

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-green-400">Calendar conectat</p>
              {googleAccount?.google_email && (
                <p className="text-sm text-white/50 mt-1">
                  {googleAccount.google_email}
                </p>
              )}
            </div>

            <a
              href="/api/google/connect"
              className="px-4 py-2 bg-white/10 rounded-lg text-center text-sm"
            >
              Reconectează
            </a>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-white/60">
              Programările confirmate pot apărea automat în Google Calendar.
            </p>

            <a
              href="/api/google/connect"
              className="px-4 py-2 bg-white text-black rounded-lg font-medium text-center text-sm"
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
            Slug booking
          </label>

          <input
            type="text"
            name="slug"
            defaultValue={barber.slug || ""}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />

          <p className="text-xs text-white/40 mt-2">Exemplu: ion-popescu</p>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">Instagram</label>

          <input
            type="text"
            name="instagram_url"
            defaultValue={barber.instagram_url || ""}
            placeholder="https://instagram.com/..."
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

      </FormWithSaveFeedback>
    </div>
  );
}

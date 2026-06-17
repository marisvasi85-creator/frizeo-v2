import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";
import AvatarUpload from "./AvatarUpload";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: barber } = await supabase
    .from("barbers")
    .select(`
  id,
  display_name,
  phone,
  slug,
  avatar_url,
  bio,
  instagram_url,
  google_calendar_connected
`)
    .eq("user_id", user.id)
    .single();
  

  return (
  <div className="space-y-6">

    <h1 className="text-2xl font-semibold">
      Profil
    </h1>

    {/* GOOGLE CALENDAR */}
    <div className="bg-[#161618] border border-white/10 rounded-xl p-6">
      <h2 className="text-lg font-semibold mb-4">
        Google Calendar
      </h2>

      {barber?.google_calendar_connected ? (
        <div className="flex items-center justify-between">
          <p className="text-green-400">
            ✅ Calendar conectat
          </p>

          <a
            href="/api/google/connect"
            className="px-4 py-2 bg-white/10 rounded-lg"
          >
            Reconectează
          </a>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-white/60">
            Calendar neconectat
          </p>

          <a
            href="/api/google/connect"
            className="px-4 py-2 bg-white text-black rounded-lg font-medium"
          >
            Conectează Google Calendar
          </a>
        </div>
      )}
    </div>

<AvatarUpload
  currentUrl={barber?.avatar_url}
/>

    <form
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
            defaultValue={barber?.display_name || ""}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Telefon
          </label>

          <input
            type="text"
            name="phone"
            defaultValue={barber?.phone || ""}
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
            defaultValue={barber?.slug || ""}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />

          <p className="text-xs text-white/40 mt-2">
            Exemplu: ion-popescu
          </p>
        </div>

<div>
  <label className="block text-sm text-white/60 mb-2">
    Instagram
  </label>

  <input
    type="text"
    name="instagram_url"
    defaultValue={
      barber?.instagram_url || ""
    }
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
    defaultValue={
      barber?.bio || ""
    }
    className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
  />
</div>

        <button
          type="submit"
          className="bg-white text-black px-5 py-3 rounded-lg font-medium"
        >
          Salvează modificările
        </button>
      </form>
    </div>
  );
}
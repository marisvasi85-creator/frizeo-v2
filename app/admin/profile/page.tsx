import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
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
      display_name,
      phone,
      slug
    `)
    .eq("user_id", user.id)
    .single();

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-semibold">
        Profil
      </h1>
      {params.saved === "1" && (
  <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl p-3">
    ✓ Date salvate cu succes
  </div>
)}
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
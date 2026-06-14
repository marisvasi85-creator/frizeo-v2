import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { updateSalon } from "./actions";

export default async function SalonPage() {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  const role = await getCurrentRole();

  if (role !== "owner") {
    redirect("/admin/dashboard");
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", barber.tenant_id)
    .single();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(`
      plans (
        name,
        max_barbers
      )
    `)
    .eq("tenant_id", barber.tenant_id)
    .single();

  const { count: activeBarbers } = await supabase
    .from("barbers")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("tenant_id", barber.tenant_id)
    .eq("active", true);

  const salonUrl = `${
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  }/booking/salon/${tenant?.slug || ""}`;

  const plan = subscription?.plans as any;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Salon
      </h1>

      {/* INFO */}
      <div className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-4">
        <div>
          <p className="text-sm text-white/60">
            Link public salon
          </p>

          <div className="mt-2 flex gap-2">
            <input
              value={salonUrl}
              readOnly
              className="flex-1 bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
            />

            <a
  href={salonUrl}
  target="_blank"
  className="px-4 py-3 bg-white text-black rounded-lg"
>
  Deschide
</a>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-white/60">
              Plan curent
            </p>

            <p className="text-lg font-medium mt-1">
              💎 {plan?.name || "Free"}
            </p>
          </div>

          <div>
            <p className="text-sm text-white/60">
              Frizeri activi
            </p>

            <p className="text-lg font-medium mt-1">
              {activeBarbers ?? 0} / {plan?.max_barbers ?? 1}
            </p>
          </div>
        </div>
      </div>

      {/* FORM */}
      <form
        action={updateSalon}
        className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-5"
      >
        <div>
          <label className="block text-sm text-white/60 mb-2">
            Nume salon
          </label>

          <input
            type="text"
            name="name"
            defaultValue={tenant?.name || ""}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-2">
            Slug salon
          </label>

          <input
            type="text"
            name="slug"
            defaultValue={tenant?.slug || ""}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3"
          />

          <p className="text-xs text-white/40 mt-2">
            Exemplu: socobarbershop
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
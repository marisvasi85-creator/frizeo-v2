import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { updateSalon } from "./actions";
import CopySalonLink from "./CopySalonLink";

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
  
  const firstDayOfMonth = new Date();
firstDayOfMonth.setDate(1);

const { count: monthBookings } = await supabase
  .from("bookings")
  .select("*", {
    count: "exact",
    head: true,
  })
  .eq("tenant_id", barber.tenant_id)
  .eq("status", "confirmed")
  .gte(
    "date",
    firstDayOfMonth
      .toISOString()
      .split("T")[0]
  );

  const salonUrl = `${
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  }/booking/salon/${tenant?.slug || ""}`;

  const plan = subscription?.plans as any;

  return (
  <div className="space-y-6">
    <h1 className="text-2xl font-semibold text-red-500">
  TEST DEPLOY
</h1>

    {/* INFO */}
    <div className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-4">

      <div>
        <p className="text-sm text-white/60">
          Link public salon
        </p>

        <div className="mt-2 flex flex-col md:flex-row gap-2">

  <input
    value={salonUrl}
    readOnly
    className="
      w-full
      min-w-0
      bg-[#0F0F10]
      border
      border-white/10
      rounded-lg
      px-4
      py-3
      truncate
    "
  />

  <div className="flex gap-2">

    <a
      href={salonUrl}
      target="_blank"
      className="
        flex-1
        text-center
        px-4
        py-3
        bg-white
        text-black
        rounded-lg
      "
    >
      Deschide
    </a>

    <CopySalonLink url={salonUrl} />

  </div>

</div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">

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

        <div>
          <p className="text-sm text-white/60">
            Programări luna aceasta
          </p>

          <p className="text-lg font-medium mt-1">
            {monthBookings ?? 0}
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
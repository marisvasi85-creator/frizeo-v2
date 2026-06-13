import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import UpgradeButton from "./UpgradeButton";

export default async function BillingPage() {
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(`
      *,
      plans (*)
    `)
    .eq("tenant_id", barber.tenant_id)
    .single();

  const { data: plans } = await supabase
    .from("plans")
    .select("*")
    .order("price", { ascending: true });

  const { count: activeBarbers } = await supabase
    .from("barbers")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("tenant_id", barber.tenant_id)
    .eq("active", true);

  const currentPlan = subscription?.plans;

  return (
    <div className="space-y-8">

      {/* CURRENT PLAN */}
      <div className="bg-[#161618] border border-white/10 rounded-xl p-6">

        <h1 className="text-2xl font-semibold mb-4">
          Abonament
        </h1>

        <div className="space-y-3">

          <p className="text-white/60 text-sm">
            Plan curent
          </p>

          <h2 className="text-3xl font-bold">
            💎 {currentPlan?.name || "Free"}
          </h2>

          <p className="text-white/60">
            Status:{" "}
            {subscription?.status === "active"
              ? "Activ"
              : subscription?.status || "Activ"}
          </p>

          <p className="text-white/60">
            Frizeri activi:{" "}
            {activeBarbers ?? 0}
            {" / "}
            {currentPlan?.max_barbers ?? 1}
          </p>

        </div>

      </div>

      {/* PLANS */}
      <div>

        <h2 className="text-xl font-semibold mb-4">
          Planuri disponibile
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {plans?.map((plan) => {
            const isCurrent =
              currentPlan?.id === plan.id;

            return (
              <div
                key={plan.id}
                className={`rounded-xl border p-6 ${
                  isCurrent
                    ? "border-green-500 bg-green-500/10"
                    : "border-white/10 bg-[#161618]"
                }`}
              >

                <div className="flex justify-between items-center">

                  <h3 className="text-xl font-semibold">
                    {plan.name}
                  </h3>

                  {isCurrent && (
                    <span className="text-xs bg-green-500 text-black px-2 py-1 rounded">
                      ACTIV
                    </span>
                  )}

                </div>

                <div className="mt-4">

                  <div className="text-3xl font-bold">
                    {plan.price} lei
                  </div>

                  <div className="text-white/60 text-sm">
                    / lună
                  </div>

                </div>

                <div className="mt-6 space-y-2 text-sm">

                  <div>
                    👥 {plan.max_barbers} frizeri
                  </div>

                  <div>
                    📅{" "}
                    {plan.max_bookings_per_month
                      ? `${plan.max_bookings_per_month} programări / lună`
                      : "Programări nelimitate"}
                  </div>

                </div>

                <div className="mt-6">

                  {plan.slug === "custom" ? (
                    <a
                      href="mailto:office@frizeo.ro"
                      className="block w-full text-center bg-white text-black py-2 rounded"
                    >
                      Contactează-ne
                    </a>
                  ) : isCurrent ? (
                    <button
                      disabled
                      className="w-full bg-green-500 text-black py-2 rounded"
                    >
                      Plan activ
                    </button>
                  ) : (
                    <UpgradeButton
                      planId={plan.id}
                    />
                  )}

                </div>

              </div>
            );
          })}

        </div>

      </div>

    </div>
  );
}
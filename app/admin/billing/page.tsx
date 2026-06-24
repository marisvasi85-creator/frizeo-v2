import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import UpgradeButton from "./UpgradeButton";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { CANONICAL_PLAN_SLUGS, sortPlansByCanonicalOrder } from "@/lib/billing/plans";
import AdminPageHeader from "../components/AdminPageHeader";
import AdminCard from "../components/AdminCard";
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout: checkoutStatus } = await searchParams;
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }
  const role = await getCurrentRole();

if (role !== "owner") {
  redirect("/admin/dashboard");
}
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(`
      *,
      plans (*)
    `)
    .eq("tenant_id", barber.tenant_id)
    .single();

  const { data: plansRaw } = await supabase
    .from("plans")
    .select("*")
    .in("slug", CANONICAL_PLAN_SLUGS);

  const plans = sortPlansByCanonicalOrder(plansRaw ?? []);

  const { count: activeBarbers } = await supabase
    .from("barbers")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("tenant_id", barber.tenant_id)
    .eq("active", true);

  const currentPlan = subscription?.plans;

  const isTrial =
  subscription?.status === "trialing";

const trialEnds =
  subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;

const trialDaysLeft =
  trialEnds
    ? Math.max(
        0,
        Math.ceil(
          (trialEnds.getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
        )
      )
    : 0;

  return (
    <div className="space-y-8">

      <AdminPageHeader title="Abonament" />

      {checkoutStatus === "success" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-300 text-sm">
          Plata a fost procesată. Planul tău se actualizează în câteva secunde.
        </div>
      )}

      {checkoutStatus === "canceled" && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-200 text-sm">
          Plata a fost anulată. Poți încerca din nou când dorești.
        </div>
      )}

      <AdminCard>
        <div className="space-y-3">

          <p className="text-white/60 text-sm">
            Plan curent
          </p>

          <h2 className="text-3xl font-bold">
  {isTrial
    ? "🚀 Trial Gratuit"
    : `💎 ${currentPlan?.name || "Free"}`}
</h2>

          <p className="text-white/60">
  Status:{" "}
  {isTrial
    ? `Trial (${trialDaysLeft} zile rămase)`
    : subscription?.status === "active"
    ? "Activ"
    : subscription?.status || "Activ"}
</p>

          <p className="text-white/60">
            Frizeri activi:{" "}
            {activeBarbers ?? 0}
            {" / "}
            {currentPlan?.max_barbers ?? 1}
          </p>

{isTrial && (
  <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
    <p className="font-medium text-blue-300">
      🚀 Perioadă de probă activă
    </p>

    <p className="text-sm text-white/70 mt-1">
      Ai acces Pro+ (3 frizeri, SMS, programări nelimitate)
      încă {trialDaysLeft} zile.
      După expirare vei trece automat pe planul Free.
    </p>
  </div>
  
)}
        </div>

      </AdminCard>

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
  <span
    className={`text-xs px-2 py-1 rounded ${
      isTrial
        ? "bg-blue-500 text-white"
        : "bg-green-500 text-black"
    }`}
  >
    {isTrial ? "TRIAL ACTIV" : "ACTIV"}
  </span>
)}

                </div>

                <div className="mt-4">

                  <div className="text-3xl font-bold">
                    {plan.slug === "custom"
                      ? "La cerere"
                      : `${plan.price} lei`}
                  </div>

                  {plan.slug !== "custom" && (
                    <div className="text-white/60 text-sm">/ lună</div>
                  )}

                </div>

                <div className="mt-6 space-y-2 text-sm">

                  <div>
                    👥{" "}
                    {plan.max_barbers
                      ? `${plan.max_barbers} frizeri`
                      : "Frizeri personalizat"}
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
      className={`w-full py-2 rounded ${
        isTrial
          ? "bg-blue-500 text-white"
          : "bg-green-500 text-black"
      }`}
    >
      {isTrial ? "Trial activ" : "Plan activ"}
    </button>
  ) : (
    <UpgradeButton planId={plan.id} planName={plan.name} />
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
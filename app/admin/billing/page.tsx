import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import BillingPlansSection from "./BillingPlansSection";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { syncStripeSubscription } from "@/lib/billing/syncStripeSubscription";
import { syncTenantBillingFromStripeCustomer } from "@/lib/billing/syncTenantBillingFromStripeCustomer";
import { CANONICAL_PLAN_SLUGS, sortPlansByCanonicalOrder } from "@/lib/billing/plans";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminPageHeader from "../components/AdminPageHeader";
import AdminCard from "../components/AdminCard";

async function syncAfterCheckout(
  sessionId: string,
  tenantId: string
) {
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    if (
      session.mode !== "subscription" ||
      typeof session.subscription !== "string"
    ) {
      return;
    }

    const subscription = await getStripe().subscriptions.retrieve(
      session.subscription
    );

    await syncStripeSubscription(
      subscription,
      session.metadata?.tenant_id ?? tenantId
    );

    const customerId =
      typeof session.customer === "string" ? session.customer : null;

    if (customerId) {
      await syncTenantBillingFromStripeCustomer(tenantId, customerId);
    }
  } catch (err) {
    console.error("billing syncAfterCheckout:", err);
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const { checkout: checkoutStatus, session_id: sessionId } =
    await searchParams;
  const supabase = await createSupabaseServerClient();

  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }
  const role = await getCurrentRole();

  if (role !== "owner") {
    redirect("/admin/dashboard");
  }

  if (checkoutStatus === "success" && sessionId) {
    await syncAfterCheckout(sessionId, barber.tenant_id);
  }

  const { data: subscription } = await supabaseAdmin
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

  const allowBankTransfer =
    isTrial ||
    currentPlan?.slug === "free" ||
    !subscription?.stripe_subscription_id;

  const pendingBankTransfer =
    Boolean(subscription?.stripe_subscription_id) &&
    (currentPlan?.slug === "free" || isTrial);

  return (
    <div className="space-y-8">

      <AdminPageHeader title="Abonament" />

      {checkoutStatus === "success" && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-300 text-sm">
          Mulțumim! Plata a fost înregistrată. Planul tău este activ — poate dura
          câteva secunde până apare mai sus.
        </div>
      )}

      {checkoutStatus === "canceled" && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-200 text-sm">
          Plata a fost anulată. Poți încerca din nou când dorești.
        </div>
      )}

      {pendingBankTransfer && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 text-blue-200 text-sm">
          Ai o factură cu transfer bancar în așteptare. Planul se activează după
          ce Stripe confirmă plata (de obicei 1–3 zile lucrătoare). Verifică emailul
          cu instrucțiuni de plată sau contactează-ne dacă ai deja transferat.
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
    : subscription?.status === "past_due"
    ? "Plată restantă"
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

      <BillingPlansSection
        plans={plans ?? []}
        currentPlanId={currentPlan?.id}
        isTrial={isTrial}
        allowBankTransfer={allowBankTransfer}
      />

    </div>
  );
}
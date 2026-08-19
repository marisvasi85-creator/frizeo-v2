import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminSession } from "@/lib/auth/getAdminSession";
import BillingPlansSection from "./BillingPlansSection";
import PayInvoiceButton from "./PayInvoiceButton";
import ManageSubscriptionButton from "./ManageSubscriptionButton";
import { BillingInvoicesSection } from "./BillingProfileSection";
import { syncAfterCheckoutSession } from "@/lib/billing/syncAfterCheckoutSession";
import { CANONICAL_PLAN_SLUGS, sortPlansByCanonicalOrder } from "@/lib/billing/plans";
import { supabaseAdmin } from "@/lib/supabase/admin";
import AdminPageHeader from "../components/AdminPageHeader";
import AdminCard from "../components/AdminCard";
import BillingConversionTracker from "./BillingConversionTracker";
import { getTrialDays } from "@/lib/billing/getTrialDays";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    session_id?: string;
    updated?: string;
  }>;
}) {
  const {
    checkout: checkoutStatus,
    session_id: sessionId,
    updated: planUpdated,
  } = await searchParams;

  const adminSession = await getAdminSession();

  if (!adminSession?.tenantId) {
    redirect("/login");
  }

  if (adminSession.role !== "owner") {
    redirect("/admin/dashboard");
  }

  const tenantId = adminSession.tenantId;

  if (checkoutStatus === "success" && sessionId) {
    await syncAfterCheckoutSession(sessionId, tenantId);
  }

  const supabase = await createSupabaseServerClient();

  const [subscriptionRes, plansRawRes, activeBarbersRes] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select(
        `
      *,
      plans (*)
    `,
      )
      .eq("tenant_id", tenantId)
      .single(),
    supabase.from("plans").select("*").in("slug", CANONICAL_PLAN_SLUGS),
    supabase
      .from("barbers")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("active", true),
  ]);

  const subscription = subscriptionRes.data;
  const plans = sortPlansByCanonicalOrder(plansRawRes.data ?? []);
  const activeBarbers = activeBarbersRes.count;

  const currentPlan = subscription?.plans;

  const isTrial =
    subscription?.status === "trialing" && !subscription?.stripe_subscription_id;

  const trialEnds = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at)
    : null;

  // Server request time — countdown for admin display
  // eslint-disable-next-line react-hooks/purity -- intentional per-request clock
  const nowMs = Date.now();
  const trialDaysLeft = trialEnds
    ? Math.max(0, Math.ceil((trialEnds.getTime() - nowMs) / (1000 * 60 * 60 * 24)))
    : 0;

  const isPastDue = subscription?.status === "past_due";
  const canManageStripe = Boolean(subscription?.stripe_customer_id);
  const isPaidStripeSub = Boolean(subscription?.stripe_subscription_id);
  const freeBookingLimit =
    typeof currentPlan?.max_bookings_per_month === "number"
      ? currentPlan.max_bookings_per_month
      : null;
  const trialDaysConfigured = getTrialDays();
  const maxBarbers = currentPlan?.max_barbers ?? null;
  const activeBarberCount = activeBarbers ?? 0;
  const isOverBarberLimit =
    maxBarbers !== null && activeBarberCount > maxBarbers;

  return (
    <div className="space-y-8">
      <BillingConversionTracker
        checkoutStatus={checkoutStatus}
        sessionId={sessionId}
        planName={currentPlan?.name}
        planPrice={currentPlan?.price}
      />

      <AdminPageHeader title="Abonament" />

      {checkoutStatus === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700 text-sm">
          {planUpdated
            ? "Planul a fost actualizat."
            : "Mulțumim! Plata a fost înregistrată."}
        </div>
      )}

      {checkoutStatus === "canceled" && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-700 text-sm">
          Plata a fost anulată. Poți încerca din nou când dorești.
        </div>
      )}

      {isPastDue && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm space-y-3">
          <p>
            Ultima plată nu a reușit. Până la finalizarea plății, beneficiile
            planului plătit (SMS, limite Pro, invitații echipă) sunt suspendate.
            Finalizează plata ca să le reactivezi.
          </p>
          <PayInvoiceButton />
        </div>
      )}

      {isOverBarberLimit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-700 text-sm">
          Ai {activeBarberCount} frizeri activi, dar planul permite maximum{" "}
          {maxBarbers}.{" "}
          <Link href="/admin/barbers" className="underline">
            Dezactivează frizeri
          </Link>{" "}
          până la {maxBarbers}. Nu ștergem date — doar starea activă contează.
        </div>
      )}

      <AdminCard>
        <div className="space-y-3">
          <p className="text-frz-ink/60 text-sm">Plan curent</p>

          <h2 className="text-3xl font-bold">
            {isTrial
              ? "🚀 Trial Gratuit"
              : `💎 ${currentPlan?.name || "Free"}`}
          </h2>

          <p className="text-frz-ink/60">
            Status:{" "}
            {isTrial
              ? `Trial (${trialDaysLeft} zile rămase)`
              : isPastDue
                ? "Plată restantă"
                : subscription?.status === "active"
                  ? "Activ"
                  : subscription?.status || "Activ"}
          </p>

          <p className="text-frz-ink/60">
            Frizeri activi: {activeBarberCount}
            {" / "}
            {maxBarbers ?? "∞"}
          </p>

          {freeBookingLimit != null && (
            <p className="text-frz-ink/60">
              Limită programări: {freeBookingLimit} / lună
            </p>
          )}

          {isTrial && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="font-medium text-blue-600">
                🚀 Perioadă de probă activă
              </p>
              <p className="text-sm text-frz-ink/70 mt-1">
                {currentPlan?.slug === "pro"
                  ? `Ai acces Pro (1 frizer, SMS reminder, programări nelimitate, fără invitații) încă ${trialDaysLeft} zile`
                  : `Ai acces Pro+ (până la 3 frizeri, SMS reminder, programări nelimitate) încă ${trialDaysLeft} zile`}
                {trialDaysConfigured
                  ? ` (trial ${trialDaysConfigured} zile)`
                  : ""}
                . După expirare treci automat pe Free
                {freeBookingLimit != null
                  ? ` (${freeBookingLimit} programări / lună)`
                  : ""}
                .
              </p>
            </div>
          )}

          {canManageStripe && isPaidStripeSub && !isTrial && (
            <div className="mt-4 pt-4 border-t border-frz-line">
              <ManageSubscriptionButton />
            </div>
          )}
        </div>
      </AdminCard>

      <BillingPlansSection
        plans={plans ?? []}
        currentPlanId={currentPlan?.id}
        currentPlanSlug={currentPlan?.slug}
        isTrial={isTrial}
        activeBarbers={activeBarberCount}
      />

      <BillingInvoicesSection tenantId={tenantId} />
    </div>
  );
}

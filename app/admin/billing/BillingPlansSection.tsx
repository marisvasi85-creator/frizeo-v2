"use client";

import UpgradeButton from "./UpgradeButton";
import { isPlanDowngrade } from "@/lib/billing/plans";

type Plan = {
  id: string;
  name: string;
  slug: string;
  price: number;
  max_barbers: number | null;
  max_bookings_per_month: number | null;
};

type Props = {
  plans: Plan[];
  currentPlanId: string | undefined;
  currentPlanSlug: string | undefined;
  isTrial: boolean;
};

export default function BillingPlansSection({
  plans,
  currentPlanId,
  currentPlanSlug,
  isTrial,
}: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Planuri disponibile</h2>
      <p className="text-sm text-white/60 mb-4">
        Alegi planul → plătești cu cardul în Stripe → revii aici cu planul activ.
        Factura fiscală se emite separat (FGO).
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isPaidPlan = plan.slug === "pro" || plan.slug === "pro-plus";
          const canPurchaseDuringTrial = isTrial && isCurrent && isPaidPlan;
          const isLowerPlan =
            !isCurrent &&
            currentPlanSlug &&
            isPlanDowngrade(currentPlanSlug, plan.slug);

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
                <h3 className="text-xl font-semibold">{plan.name}</h3>

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
                ) : isLowerPlan ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 rounded bg-white/10 text-white/50 cursor-not-allowed"
                    >
                      Plan inferior
                    </button>
                    <p className="text-xs text-white/50 text-center">
                      Beneficiezi deja de un plan mai mare.
                    </p>
                  </div>
                ) : isCurrent && !canPurchaseDuringTrial ? (
                  <button
                    type="button"
                    disabled
                    className={`w-full py-2 rounded ${
                      isTrial
                        ? "bg-blue-500 text-white"
                        : "bg-green-500 text-black"
                    }`}
                  >
                    {isTrial ? "Trial activ" : "Plan activ"}
                  </button>
                ) : plan.slug === "free" ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2 rounded bg-white/10 text-white/50 cursor-not-allowed"
                  >
                    Plan Free
                  </button>
                ) : isPaidPlan ? (
                  <UpgradeButton
                    planId={plan.id}
                    planName={plan.name}
                    trialEarlyPurchase={canPurchaseDuringTrial}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

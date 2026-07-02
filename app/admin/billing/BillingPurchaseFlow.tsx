"use client";

import { useState } from "react";
import BillingPlansSection from "./BillingPlansSection";
import BillingProfileForm from "./BillingProfileForm";

type Plan = {
  id: string;
  name: string;
  slug: string;
  price: number;
  max_barbers: number | null;
  max_bookings_per_month: number | null;
};

export default function BillingPurchaseFlow({
  plans,
  currentPlanId,
  currentPlanSlug,
  isTrial,
  initialBillingComplete,
}: {
  plans: Plan[];
  currentPlanId: string | undefined;
  currentPlanSlug: string | undefined;
  isTrial: boolean;
  initialBillingComplete: boolean;
}) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [billingComplete, setBillingComplete] = useState(initialBillingComplete);

  function handlePlanSelected(plan: Plan) {
    setSelectedPlan(plan);
    setTimeout(() => {
      document.getElementById("billing-profile-form")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);
  }

  return (
    <div className="space-y-8">
      <BillingPlansSection
        plans={plans}
        currentPlanId={currentPlanId}
        currentPlanSlug={currentPlanSlug}
        isTrial={isTrial}
        selectedPlanId={selectedPlan?.id ?? null}
        onSelectPlan={handlePlanSelected}
      />

      {selectedPlan && (
        <BillingProfileForm
          selectedPlan={selectedPlan}
          initialComplete={initialBillingComplete}
          billingComplete={billingComplete}
          onBillingCompleteChange={setBillingComplete}
          onClearPlan={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}

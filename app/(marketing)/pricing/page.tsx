import JsonLd from "@/app/components/JsonLd";
import PricingAnalytics from "@/app/components/analytics/PricingAnalytics";
import PricingPlanCta from "@/app/components/analytics/PricingPlanCta";
import { LEGAL_COMPANY, LEGAL_PRICING } from "@/lib/legal/company";
import { breadcrumbJsonLd } from "@/lib/site/jsonLd";
import { createPageMetadata } from "@/lib/site/pageMetadata";

function parsePlanPrice(price: string): number | undefined {
  const match = price.match(/(\d+)/);
  return match ? Number(match[1]) : undefined;
}

export const metadata = createPageMetadata({
  title: "Prețuri",
  description: `Planuri Free, Pro și Pro+ pentru programări online. ${LEGAL_PRICING.trialDays} zile trial Pro+ cu SMS reminder inclus.`,
  path: "/pricing",
  keywords: [
    "prețuri frizeo",
    "abonament programări frizerie",
    "plan pro frizerie",
  ],
});

export default function PricingPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Acasă", path: "/" },
          { name: "Prețuri", path: "/pricing" },
        ])}
      />
      <PricingAnalytics />
      <main className="bg-white text-gray-900">
        <section className="px-6 py-20 max-w-5xl mx-auto text-center">
          <h1 className="text-4xl font-semibold mb-4">Prețuri simple</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            {LEGAL_PRICING.trialDays} zile trial Pro+ cu SMS reminder inclus.
            După trial rămâi pe Free sau treci la Pro / Pro+.
          </p>
          <p className="text-gray-700 max-w-2xl mx-auto mt-4 text-sm font-medium">
            {LEGAL_PRICING.includedNote}
          </p>
        </section>

        <section className="px-6 pb-24 max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {LEGAL_PRICING.plans.map((plan) => (
              <div
                key={plan.slug}
                className={`rounded-2xl border p-6 flex flex-col ${
                  plan.highlighted
                    ? "border-black shadow-lg ring-1 ring-black"
                    : "border-gray-200"
                }`}
              >
                {plan.highlighted && (
                  <span className="text-xs font-medium text-white bg-black px-2 py-1 rounded-full self-start mb-3">
                    Recomandat
                  </span>
                )}

                <h2 className="text-xl font-semibold">{plan.name}</h2>

                <div className="mt-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.priceNote && (
                    <span className="text-gray-500 text-sm ml-1">
                      {plan.priceNote}
                    </span>
                  )}
                </div>

                <ul className="mt-6 space-y-2 text-sm text-gray-600 flex-1">
                  <li>👤 {plan.barbers}</li>
                  <li>📅 {plan.bookings}</li>
                  <li>
                    {plan.sms
                      ? plan.slug === "custom"
                        ? "📱 SMS negociat (inclusiv extins)"
                        : "📱 SMS reminder inclus"
                      : "📱 Fără SMS"}
                  </li>
                  {plan.features.map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>

                <PricingPlanCta
                  href={plan.cta.href}
                  label={plan.cta.label}
                  planName={plan.name}
                  planPrice={parsePlanPrice(plan.price)}
                  trackSelection={
                    plan.slug === "pro" || plan.slug === "pro-plus"
                  }
                  className={`mt-8 block text-center py-3 rounded-xl font-medium transition ${
                    plan.highlighted
                      ? "bg-black text-white hover:bg-gray-800"
                      : "border border-gray-300 hover:bg-gray-50"
                  }`}
                />
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-500 mt-10 max-w-2xl mx-auto">
            Planul Custom se configurează individual —{" "}
            <a
              href={`mailto:${LEGAL_COMPANY.billingEmail}`}
              className="text-black underline"
            >
              {LEGAL_COMPANY.billingEmail}
            </a>
            . Se aplică{" "}
            <a href="/terms" className="text-black underline">
              Politica de utilizare rezonabilă (Fair Use)
            </a>
            .
          </p>
        </section>
      </main>
    </>
  );
}

import Link from "next/link";
import { LEGAL_COMPANY, LEGAL_PRICING } from "@/lib/legal/company";

export default function PricingPage() {
  return (
    <main className="bg-white text-gray-900">
      <section className="px-6 py-20 max-w-5xl mx-auto text-center">
        <h1 className="text-4xl font-semibold mb-4">Prețuri simple</h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          {LEGAL_PRICING.trialDays} zile trial Pro+ cu SMS inclus. După trial
          rămâi pe Free sau treci la Pro / Pro+.
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
                <li>{plan.sms ? "📱 SMS inclus" : "📱 Fără SMS"}</li>
                {plan.features.map((f) => (
                  <li key={f}>✓ {f}</li>
                ))}
              </ul>

              <Link
                href={plan.cta.href}
                className={`mt-8 block text-center py-3 rounded-xl font-medium transition ${
                  plan.highlighted
                    ? "bg-black text-white hover:bg-gray-800"
                    : "border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {plan.cta.label}
              </Link>
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
          .
        </p>
      </section>
    </main>
  );
}

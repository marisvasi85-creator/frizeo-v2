import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import { LEGAL_COMPANY } from "@/lib/legal/company";
import { breadcrumbJsonLd, contactPageJsonLd } from "@/lib/site/jsonLd";
import { createPageMetadata } from "@/lib/site/pageMetadata";

export const metadata = createPageMetadata({
  title: "Contact",
  description:
    "Contactează echipa Frizeo pentru suport, întrebări despre cont sau planuri Pro, Pro+ și Custom.",
  path: "/contact",
  keywords: ["contact frizeo", "suport programări frizerie"],
});

export default function ContactPage() {
  return (
    <>
      <JsonLd
        data={contactPageJsonLd()}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Acasă", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
    <main className="bg-white text-gray-900">
      <section className="px-6 py-20 max-w-2xl mx-auto">
        <h1 className="text-4xl font-semibold mb-4">Contact</h1>
        <p className="text-gray-600 mb-10">
          Suntem aici pentru întrebări despre platformă, planuri sau contul
          tău.
        </p>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold mb-1">Suport general</h2>
            <p className="text-sm text-gray-600 mb-3">
              Întrebări tehnice, cont, programări.
            </p>
            <a
              href={`mailto:${LEGAL_COMPANY.email}`}
              className="text-black font-medium hover:underline"
            >
              {LEGAL_COMPANY.email}
            </a>
          </div>

          <div className="rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold mb-1">Abonamente & Custom</h2>
            <p className="text-sm text-gray-600 mb-3">
              Upgrade Pro / Pro+ sau plan personalizat (4+ frizeri).
            </p>
            <a
              href={`mailto:${LEGAL_COMPANY.billingEmail}`}
              className="text-black font-medium hover:underline"
            >
              {LEGAL_COMPANY.billingEmail}
            </a>
          </div>

          <div className="rounded-2xl border border-gray-200 p-6">
            <h2 className="font-semibold mb-1">Confidențialitate (GDPR)</h2>
            <p className="text-sm text-gray-600 mb-3">
              Solicitări acces, ștergere sau rectificare date.
            </p>
            <a
              href={`mailto:${LEGAL_COMPANY.privacyEmail}`}
              className="text-black font-medium hover:underline"
            >
              {LEGAL_COMPANY.privacyEmail}
            </a>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-10">
          Răspundem de obicei în 1–2 zile lucrătoare. Documente legale:{" "}
          <Link href="/privacy" className="underline hover:text-black">
            Confidențialitate
          </Link>
          ,{" "}
          <Link href="/terms" className="underline hover:text-black">
            Termeni
          </Link>
          .
        </p>
      </section>
    </main>
    </>
  );
}

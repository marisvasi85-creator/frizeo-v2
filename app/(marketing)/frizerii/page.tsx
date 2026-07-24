import Link from "next/link";
import { listDirectoryCities } from "@/lib/seo/directorySalons";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import JsonLd from "@/app/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/site/jsonLd";

export const metadata = createPageMetadata({
  title: "Frizerii și barbershop-uri — programări online",
  description:
    "Găsește frizerii și barbershop-uri din România cu programare online pe Frizeo. Alege orașul și rezervă direct.",
  path: "/frizerii",
  keywords: [
    "frizerii România",
    "barbershop programări online",
    "frizerie aproape",
    "programare frizer",
  ],
});

export default async function FrizeriiIndexPage() {
  const cities = await listDirectoryCities();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Acasă", path: "/" },
          { name: "Frizerii", path: "/frizerii" },
        ])}
      />
      <main className="bg-white text-gray-900">
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Frizerii cu programări online
          </h1>
          <p className="mt-4 text-gray-600 max-w-2xl">
            Saloane pe Frizeo, organizate pe oraș. Alegi salonul, frizerul și
            ora — fără telefon. Poți filtra după tip de serviciu și vedea
            saloanele pe hartă.
          </p>

          <p className="mt-6">
            <Link
              href="/frizerii/harta"
              className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Vezi harta saloanelor →
            </Link>
          </p>

          {cities.length === 0 ? (
            <p className="mt-10 text-gray-500">
              Încă nu sunt saloane listate în director. Completează orașul în
              setările salonului pentru a apărea aici.
            </p>
          ) : (
            <ul className="mt-10 grid sm:grid-cols-2 gap-3">
              {cities.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/frizerii/${c.slug}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <span className="font-medium">Frizerii în {c.city}</span>
                    <span className="text-sm text-gray-500">
                      {c.count} {c.count === 1 ? "salon" : "saloane"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

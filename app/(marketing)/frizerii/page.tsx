import Link from "next/link";
import type { Metadata } from "next";
import { listDirectoryCities } from "@/lib/seo/directorySalons";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import JsonLd from "@/app/components/JsonLd";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  faqPageJsonLd,
  itemListJsonLd,
  jsonLdGraph,
} from "@/lib/site/jsonLd";

const PAGE_PATH = "/frizerii";

const DIRECTORY_FAQS = [
  {
    question: "Cum rezerv o programare la frizerie pe Frizeo?",
    answer:
      "Alegi orașul, apoi salonul și frizerul. Selectezi serviciul, data și ora disponibilă — confirmarea ajunge pe email, fără telefon.",
  },
  {
    question: "Pot vedea frizeriile pe hartă?",
    answer:
      "Da. Din director poți deschide harta saloanelor Frizeo și naviga direct către pagina de programare a salonului.",
  },
  {
    question: "Programarea online costă ceva pentru client?",
    answer:
      "Nu. Rezervarea prin Frizeo este gratuită pentru client. Plătești serviciul la salon, ca de obicei.",
  },
  {
    question: "Cum apare salonul meu în director?",
    answer:
      "Creezi cont Frizeo, completezi orașul și locația în setările salonului și activezi listarea în director. Apoi pagina ta de oraș și rezervările online apar automat.",
  },
] as const;

function directoryDescription(cityCount: number, salonCount: number): string {
  if (cityCount === 0) {
    return "Găsește frizerii și barbershop-uri din România cu programare online pe Frizeo. Alege orașul și rezervă direct.";
  }

  return `Găsește frizerii și barbershop-uri din România cu programare online pe Frizeo. ${salonCount} ${
    salonCount === 1 ? "salon" : "saloane"
  } în ${cityCount} ${cityCount === 1 ? "oraș" : "orașe"} — alege locația și rezervă fără telefon.`;
}

export async function generateMetadata(): Promise<Metadata> {
  const cities = await listDirectoryCities();
  const salonCount = cities.reduce((sum, city) => sum + city.count, 0);

  return createPageMetadata({
    title: "Frizerii și barbershop-uri — programări online",
    description: directoryDescription(cities.length, salonCount),
    path: PAGE_PATH,
    keywords: [
      "frizerii România",
      "barbershop programări online",
      "frizerie aproape",
      "programare frizer",
      "director frizerii",
      "rezervare frizerie online",
    ],
  });
}

export default async function FrizeriiIndexPage() {
  const cities = await listDirectoryCities();
  const salonCount = cities.reduce((sum, city) => sum + city.count, 0);
  const description = directoryDescription(cities.length, salonCount);

  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          collectionPageJsonLd({
            name: "Frizerii și barbershop-uri — programări online",
            description,
            path: PAGE_PATH,
          }),
          breadcrumbJsonLd([
            { name: "Acasă", path: "/" },
            { name: "Frizerii", path: PAGE_PATH },
          ]),
          itemListJsonLd({
            name: "Orașe cu frizerii pe Frizeo",
            description,
            path: PAGE_PATH,
            items: cities.map((city) => ({
              name: `Frizerii în ${city.city}`,
              path: `/frizerii/${city.slug}`,
            })),
          }),
          faqPageJsonLd([...DIRECTORY_FAQS])
        )}
      />
      <main className="bg-white text-gray-900">
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Frizerii cu programări online
          </h1>
          <p className="mt-4 text-gray-600 max-w-2xl leading-relaxed">
            Directorul Frizeo adună frizerii și barbershop-uri din România unde
            poți rezerva online: alegi serviciul, ziua și ora, fără apeluri și
            fără mesaje pierdute. Organizăm saloanele pe oraș, ca să găsești
            rapid o programare aproape de tine.
          </p>
          {cities.length > 0 && (
            <p className="mt-3 text-gray-600 max-w-2xl">
              Acum sunt listate{" "}
              <strong className="font-medium text-gray-900">
                {salonCount} {salonCount === 1 ? "salon" : "saloane"}
              </strong>{" "}
              în{" "}
              <strong className="font-medium text-gray-900">
                {cities.length} {cities.length === 1 ? "oraș" : "orașe"}
              </strong>
              .
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/frizerii/harta"
              className="inline-flex items-center rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Vezi harta saloanelor →
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center rounded-xl bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800"
            >
              Listează-ți salonul
            </Link>
          </div>

          {cities.length === 0 ? (
            <p className="mt-10 text-gray-500">
              Încă nu sunt saloane listate în director. Completează orașul în
              setările salonului pentru a apărea aici.
            </p>
          ) : (
            <>
              <h2 className="mt-12 text-xl font-semibold tracking-tight">
                Alege orașul
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Intră pe pagina orașului ca să vezi saloanele, serviciile și
                să rezervi direct.
              </p>
              <ul className="mt-6 grid sm:grid-cols-2 gap-3">
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
            </>
          )}
        </section>

        <section className="bg-gray-50 px-6 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold tracking-tight">
              Cum funcționează rezervarea
            </h2>
            <ol className="mt-6 grid md:grid-cols-3 gap-6 text-sm text-gray-600">
              <li>
                <p className="font-medium text-gray-900 mb-1">1. Alegi orașul</p>
                <p>
                  Deschizi pagina orașului sau harta și vezi saloanele din
                  directorul Frizeo.
                </p>
              </li>
              <li>
                <p className="font-medium text-gray-900 mb-1">
                  2. Alegi salonul și frizerul
                </p>
                <p>
                  Compari serviciile disponibile și deschizi pagina publică de
                  programări.
                </p>
              </li>
              <li>
                <p className="font-medium text-gray-900 mb-1">
                  3. Confirmi ora
                </p>
                <p>
                  Selectezi data și intervalul liber. Primești confirmare pe
                  email — fără telefon.
                </p>
              </li>
            </ol>
          </div>
        </section>

        <section className="px-6 py-14">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold tracking-tight">
              Întrebări frecvente
            </h2>
            <dl className="mt-8 space-y-6">
              {DIRECTORY_FAQS.map((faq) => (
                <div key={faq.question}>
                  <dt className="font-medium text-gray-900">{faq.question}</dt>
                  <dd className="mt-2 text-gray-600 leading-relaxed">
                    {faq.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
    </>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import DirectorySalonBrowser from "../DirectorySalonBrowser";
import DirectoryMap from "../DirectoryMap";
import {
  listDirectoryCities,
  listDirectorySalons,
} from "@/lib/seo/directorySalons";
import { displayCityName } from "@/lib/seo/citySlug";
import { getCityIntro } from "@/lib/seo/cityIntro";
import { breadcrumbJsonLd } from "@/lib/site/jsonLd";
import { createPageMetadata, pageUrl } from "@/lib/site/pageMetadata";

type Props = { params: Promise<{ city: string }> };

/** Static paths under /frizerii/* that must not be treated as city slugs. */
const RESERVED_CITY_SLUGS = new Set(["harta", "map"]);

export async function generateStaticParams() {
  const cities = await listDirectoryCities();
  return [
    { city: "harta" },
    ...cities
      .filter((c) => !RESERVED_CITY_SLUGS.has(c.slug))
      .map((c) => ({ city: c.slug })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: citySlug } = await params;

  if (citySlug === "harta" || citySlug === "map") {
    return createPageMetadata({
      title: "Hartă frizerii — programări online",
      description:
        "Vezi pe hartă frizeriile și barbershop-urile din directorul Frizeo și programează-te online.",
      path: "/frizerii/harta",
      keywords: ["hartă frizerii", "barbershop hartă", "frizerie aproape"],
    });
  }

  const salons = await listDirectorySalons({ citySlug });
  const cityLabel =
    salons[0]?.location_city != null
      ? displayCityName(salons[0].location_city)
      : citySlug;

  if (salons.length === 0) {
    return createPageMetadata({
      title: `Frizerii în ${cityLabel}`,
      description: `Caută frizerii și barbershop-uri în ${cityLabel} cu programare online.`,
      path: `/frizerii/${citySlug}`,
      noIndex: true,
    });
  }

  return createPageMetadata({
    title: `Frizerii în ${cityLabel} — programări online`,
    description: `Programează-te online la frizerii și barbershop-uri din ${cityLabel}. ${salons.length} ${
      salons.length === 1 ? "salon disponibil" : "saloane disponibile"
    } pe Frizeo.`,
    path: `/frizerii/${citySlug}`,
    keywords: [
      `frizerie ${cityLabel}`,
      `barbershop ${cityLabel}`,
      `frizer ${cityLabel}`,
      `programări frizerie ${cityLabel}`,
      "programare online",
    ],
  });
}

async function HartaPage() {
  const salons = await listDirectorySalons();

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Acasă", path: "/" },
          { name: "Frizerii", path: "/frizerii" },
          { name: "Hartă", path: "/frizerii/harta" },
        ])}
      />
      <main className="bg-white text-gray-900">
        <section className="px-6 py-16 max-w-4xl mx-auto space-y-6">
          <p className="text-sm text-gray-500">
            <Link href="/frizerii" className="underline hover:text-black">
              ← Înapoi la orașe
            </Link>
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Hartă frizerii
          </h1>
          <p className="text-gray-600 max-w-2xl">
            Saloane din directorul Frizeo care au coordonate pe locație. Dacă
            harta e goală, completează lat/lng la salon în Admin → Salon.
          </p>
          <DirectoryMap salons={salons} />
        </section>
      </main>
    </>
  );
}

export default async function FrizeriiCityPage({ params }: Props) {
  const { city: citySlug } = await params;

  if (citySlug === "harta" || citySlug === "map") {
    return <HartaPage />;
  }

  const salons = await listDirectorySalons({ citySlug });

  if (salons.length === 0) {
    notFound();
  }

  const cityLabel = displayCityName(salons[0].location_city);
  const { intro } = await getCityIntro({
    citySlug,
    cityName: cityLabel,
    salonCount: salons.length,
    salonNames: salons.map((s) => s.name),
  });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Frizerii în ${cityLabel}`,
    description: intro,
    itemListElement: salons.map((salon, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: pageUrl(`/booking/salon/${salon.slug}`),
      name: salon.name,
    })),
  };

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Acasă", path: "/" },
          { name: "Frizerii", path: "/frizerii" },
          { name: cityLabel, path: `/frizerii/${citySlug}` },
        ])}
      />
      <JsonLd data={itemListJsonLd} />

      <main className="bg-white text-gray-900">
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <p className="text-sm text-gray-500 mb-2">
            <Link href="/frizerii" className="underline hover:text-black">
              Toate orașele
            </Link>
            {" · "}
            <Link href="/frizerii/harta" className="underline hover:text-black">
              Hartă
            </Link>
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Frizerii în {cityLabel}
          </h1>

          <DirectorySalonBrowser
            salons={salons}
            cityLabel={cityLabel}
            intro={intro}
            showMap
          />
        </section>
      </main>
    </>
  );
}

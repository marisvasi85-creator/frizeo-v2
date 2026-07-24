import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import {
  listDirectoryCities,
  listDirectorySalons,
} from "@/lib/seo/directorySalons";
import { displayCityName } from "@/lib/seo/citySlug";
import { breadcrumbJsonLd } from "@/lib/site/jsonLd";
import { createPageMetadata, pageUrl } from "@/lib/site/pageMetadata";

type Props = { params: Promise<{ city: string }> };

export async function generateStaticParams() {
  const cities = await listDirectoryCities();
  return cities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: citySlug } = await params;
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

export default async function FrizeriiCityPage({ params }: Props) {
  const { city: citySlug } = await params;
  const salons = await listDirectorySalons({ citySlug });

  if (salons.length === 0) {
    notFound();
  }

  const cityLabel = displayCityName(salons[0].location_city);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Frizerii în ${cityLabel}`,
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
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Frizerii în {cityLabel}
          </h1>
          <p className="mt-4 text-gray-600 max-w-2xl">
            {salons.length}{" "}
            {salons.length === 1
              ? "salon cu programare online"
              : "saloane cu programare online"}
            . Alege și rezervă direct.
          </p>

          <ul className="mt-10 space-y-4">
            {salons.map((salon) => (
              <li key={salon.id}>
                <Link
                  href={`/booking/salon/${salon.slug}`}
                  className="flex gap-4 rounded-2xl border border-gray-200 p-4 hover:bg-gray-50 transition"
                >
                  {salon.logo_url ? (
                    <Image
                      src={salon.logo_url}
                      alt={`Logo ${salon.name}`}
                      width={72}
                      height={72}
                      className="w-[72px] h-[72px] rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-[72px] h-[72px] rounded-xl bg-gray-100 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{salon.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {[salon.location_address_line, salon.location_city]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {salon.active_barbers}{" "}
                      {salon.active_barbers === 1 ? "frizer" : "frizeri"} ·
                      Programare online
                    </p>
                    {salon.description && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {salon.description}
                      </p>
                    )}
                  </div>
                  <span className="self-center text-sm font-medium whitespace-nowrap">
                    Vezi →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

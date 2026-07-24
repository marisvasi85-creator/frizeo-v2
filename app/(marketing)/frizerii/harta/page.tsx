import Link from "next/link";
import DirectoryMap from "../DirectoryMap";
import { listDirectorySalons } from "@/lib/seo/directorySalons";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import JsonLd from "@/app/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/site/jsonLd";

export const metadata = createPageMetadata({
  title: "Hartă frizerii — programări online",
  description:
    "Vezi pe hartă frizeriile și barbershop-urile din directorul Frizeo și programează-te online.",
  path: "/frizerii/harta",
  keywords: ["hartă frizerii", "barbershop hartă", "frizerie aproape"],
});

export default async function FrizeriiMapPage() {
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
            Saloane din directorul Frizeo care au coordonate pe locație.
          </p>
          <DirectoryMap salons={salons} />
        </section>
      </main>
    </>
  );
}

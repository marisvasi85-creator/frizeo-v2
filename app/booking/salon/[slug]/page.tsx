import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import JsonLd from "@/app/components/JsonLd";
import PublicLocationCard from "@/app/components/location/PublicLocationCard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicBookingPath } from "@/lib/booking/publicBookingPath";
import {
  resolveLocation,
  formatLocationAddress,
} from "@/lib/location/resolveLocation";
import { salonJsonLd } from "@/lib/site/jsonLd";
import { createPageMetadata } from "@/lib/site/pageMetadata";
import { resolveTenantBySlug } from "@/lib/slugs/slugRedirects";
import { fetchSalonSeoExtras } from "@/lib/seo/fetchSalonSeoExtras";
import {
  buildSalonSeoDescription,
  buildSalonSeoKeywords,
  buildSalonSeoTitle,
} from "@/lib/seo/salonSeo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveTenantBySlug(slug);

  if (!resolved) {
    return createPageMetadata({
      title: "Salon inexistent",
      description: "Pagina salonului nu a fost găsită.",
      path: `/booking/salon/${slug}`,
      noIndex: true,
      pwa: {
        startUrl: `/booking/salon/${slug}`,
        variant: "booking",
      },
    });
  }

  const salon = resolved.tenant;
  const startUrl = `/booking/salon/${resolved.canonicalSlug}`;
  const logo =
    typeof salon.logo_url === "string" && salon.logo_url
      ? salon.logo_url
      : null;

  return createPageMetadata({
    title: buildSalonSeoTitle(salon),
    description: buildSalonSeoDescription(salon),
    path: startUrl,
    keywords: buildSalonSeoKeywords(salon),
    image: logo,
    pwa: {
      startUrl,
      variant: "booking",
      label: String(salon.name),
    },
  });
}

export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const resolved = await resolveTenantBySlug(slug);

  if (!resolved) {
    return (
      <div className="max-w-xl mx-auto p-6">
        Salon inexistent.
      </div>
    );
  }

  if (resolved.redirected) {
    permanentRedirect(`/booking/salon/${resolved.canonicalSlug}`);
  }

  const salon = resolved.tenant;
  const salonLocation = resolveLocation(salon);

  const [{ data: gallery }, { data: barbers }, seoExtras] = await Promise.all([
    supabaseAdmin
      .from("salon_gallery")
      .select("*")
      .eq("tenant_id", salon.id)
      .order("created_at"),
    supabaseAdmin
      .from("barbers")
      .select(`
      id,
      display_name,
      slug,
      active,
      avatar_url,
      bio,
      instagram_url
    `)
      .eq("tenant_id", salon.id)
      .eq("active", true)
      .order("display_name"),
    fetchSalonSeoExtras(salon.id),
  ]);

  const streetAddress =
    (typeof salon.location_address_line === "string" &&
      salon.location_address_line.trim()) ||
    (typeof salon.address === "string" && salon.address.trim()) ||
    null;

  return (
    <>
      <JsonLd
        data={salonJsonLd({
          name: String(salon.name),
          slug: resolved.canonicalSlug,
          phone: typeof salon.phone === "string" ? salon.phone : null,
          address:
            formatLocationAddress(salon) ||
            (typeof salon.address === "string" ? salon.address : null),
          streetAddress,
          city:
            typeof salon.location_city === "string"
              ? salon.location_city
              : null,
          county:
            typeof salon.location_county === "string"
              ? salon.location_county
              : null,
          postalCode:
            typeof salon.location_postal_code === "string"
              ? salon.location_postal_code
              : null,
          description:
            typeof salon.description === "string" ? salon.description : null,
          logoUrl: typeof salon.logo_url === "string" ? salon.logo_url : null,
          imageUrls: seoExtras.galleryUrls,
          latitude: salonLocation?.latitude ?? null,
          longitude: salonLocation?.longitude ?? null,
          mapsUrl: salonLocation?.mapsUrl || null,
          openingHours: seoExtras.openingHours,
          openingHoursSpecification: seoExtras.openingHoursSpecification,
          priceRange: seoExtras.priceRange,
        })}
      />
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
          {typeof salon.logo_url === "string" && salon.logo_url && (
            <Image
              src={salon.logo_url}
              alt={`Logo ${salon.name}`}
              width={96}
              height={96}
              className="w-24 h-24 rounded-2xl object-cover mx-auto mb-4"
              priority
            />
          )}

          <h1 className="text-3xl font-bold">{String(salon.name)}</h1>

          {typeof salon.location_city === "string" &&
            salon.location_city.trim() && (
              <p className="text-gray-500 mt-2">
                Frizerie în {salon.location_city.trim()}
              </p>
            )}

          {typeof salon.phone === "string" && salon.phone && (
            <p className="text-gray-600 mt-3">📞 {salon.phone}</p>
          )}

          {typeof salon.description === "string" && salon.description && (
            <p className="text-gray-700 mt-4 max-w-2xl mx-auto">
              {salon.description}
            </p>
          )}

          {gallery && gallery.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Galerie</h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {gallery.map((img) => (
                  <div key={img.id} className="relative w-full h-48">
                    <Image
                      src={img.image_url}
                      alt={`Galerie ${salon.name}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 33vw"
                      className="object-cover rounded-xl border"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Alege frizerul</h2>

          <div className="grid gap-4">
            {barbers?.map((barber) => (
              <Link
                key={barber.id}
                href={publicBookingPath(salon.slug, barber.slug)}
                className="block border rounded-2xl p-5 hover:shadow-md transition bg-white"
              >
                <div className="flex items-center gap-4">
                  {barber.avatar_url ? (
                    <Image
                      src={barber.avatar_url}
                      alt={`${barber.display_name} — ${salon.name}`}
                      width={80}
                      height={80}
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-200" />
                  )}

                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">
                      {barber.display_name}
                    </h3>

                    {barber.bio && (
                      <p className="text-sm text-gray-600 mt-1">{barber.bio}</p>
                    )}

                    {barber.instagram_url && (
                      <p className="text-sm text-blue-600 mt-2">Instagram</p>
                    )}
                  </div>

                  <div className="px-4 py-2 rounded-lg bg-black text-white text-sm">
                    Rezervă
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {salonLocation && (
          <div className="max-w-xl mx-auto">
            <PublicLocationCard location={salonLocation} />
          </div>
        )}
      </div>
    </>
  );
}

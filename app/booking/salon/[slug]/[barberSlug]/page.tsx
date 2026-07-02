import BookingClient from "@/app/booking/[barberId]/components/BookingClient";
import type { Metadata } from "next";
import JsonLd from "@/app/components/JsonLd";
import PublicLocationCard from "@/app/components/location/PublicLocationCard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { barberBookingJsonLd } from "@/lib/site/jsonLd";
import { resolveBarberLocation, formatLocationAddress } from "@/lib/location/resolveLocation";
import { createPageMetadata } from "@/lib/site/pageMetadata";

async function getSalon(slug: string) {
  const { data } = await supabaseAdmin
    .from("tenants")
    .select(`
      id,
      name,
      slug,
      logo_url,
      phone,
      address,
      description,
      location_address_line,
      location_city,
      location_county,
      location_postal_code,
      location_maps_url,
      location_latitude,
      location_longitude
    `)
    .eq("slug", slug)
    .single();

  return data;
}

async function getActiveBarber(tenantId: string, barberSlug: string) {
  const { data } = await supabaseAdmin
    .from("barbers")
    .select(`
      id,
      display_name,
      avatar_url,
      bio,
      instagram_url,
      use_salon_location,
      location_address_line,
      location_city,
      location_county,
      location_postal_code,
      location_maps_url,
      location_latitude,
      location_longitude
    `)
    .eq("tenant_id", tenantId)
    .eq("slug", barberSlug)
    .eq("active", true)
    .single();

  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{
    slug: string;
    barberSlug: string;
  }>;
}): Promise<Metadata> {
  const { slug, barberSlug } = await params;
  const salon = await getSalon(slug);

  if (!salon) {
    return createPageMetadata({
      title: "Salon inexistent",
      description: "Pagina salonului nu a fost găsită.",
      path: `/booking/salon/${slug}/${barberSlug}`,
      noIndex: true,
    });
  }

  const barber = await getActiveBarber(salon.id, barberSlug);

  if (!barber) {
    return createPageMetadata({
      title: "Frizer indisponibil",
      description: `${barberSlug} nu este disponibil pentru programări online.`,
      path: `/booking/salon/${slug}/${barberSlug}`,
      noIndex: true,
    });
  }

  const barberName = barber.display_name || "Frizer";

  return createPageMetadata({
    title: `Programare online — ${barberName}`,
    description: `Programează-te la ${barberName}, ${salon.name}. Alege serviciul, data și ora disponibilă.`,
    path: `/booking/salon/${slug}/${barberSlug}`,
    keywords: [barberName, salon.name, "programare frizer online"],
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{
    slug: string;
    barberSlug: string;
  }>;
}) {
  const { slug, barberSlug } = await params;
  const salon = await getSalon(slug);

  if (!salon) {
    return <div>Salon inexistent</div>;
  }

  const { data: inactiveBarber } = await supabaseAdmin
    .from("barbers")
    .select("id, display_name")
    .eq("tenant_id", salon.id)
    .eq("slug", barberSlug)
    .eq("active", false)
    .maybeSingle();

  if (inactiveBarber) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        Frizer indisponibil momentan pentru programări online.
      </div>
    );
  }

  const barber = await getActiveBarber(salon.id, barberSlug);

  if (!barber) {
    return <div>Frizer inexistent</div>;
  }

  const barberName = barber.display_name || "Frizer";
  const bookingLocation = resolveBarberLocation(salon, barber);

  return (
    <>
      <JsonLd
        data={barberBookingJsonLd({
          salon: {
            name: salon.name,
            slug: salon.slug,
            phone: salon.phone,
            address: formatLocationAddress(salon) || salon.address,
            description: salon.description,
            logoUrl: salon.logo_url,
          },
          barberName,
          barberSlug,
        })}
      />
      <div className="bg-white min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="bg-white border rounded-2xl p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {salon.logo_url && (
                <img
                  src={salon.logo_url}
                  alt={`Logo ${salon.name}`}
                  className="w-24 h-24 rounded-2xl object-cover"
                />
              )}

              <div>
                <h1 className="text-3xl font-bold">{salon.name}</h1>

                {salon.phone && (
                  <p className="text-gray-600 mt-2">📞 {salon.phone}</p>
                )}
              </div>
            </div>

            {bookingLocation && (
              <div className="mt-6">
                <PublicLocationCard location={bookingLocation} />
              </div>
            )}

            {salon.description && (
              <p className="mt-4 text-gray-700">{salon.description}</p>
            )}
          </div>

          <div className="bg-white border rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-4">
              {barber.avatar_url ? (
                <img
                  src={barber.avatar_url}
                  alt={`${barberName} — ${salon.name}`}
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200" />
              )}

              <div>
                <h2 className="text-xl font-semibold">{barberName}</h2>

                {barber.bio && (
                  <p className="text-gray-600">{barber.bio}</p>
                )}

                {barber.instagram_url && (
                  <a
                    href={barber.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-sm"
                  >
                    Instagram
                  </a>
                )}
              </div>
            </div>
          </div>

          <BookingClient barberId={barber.id} barberName={barberName} />
        </div>
      </div>
    </>
  );
}

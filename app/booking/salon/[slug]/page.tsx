import Link from "next/link";
import type { Metadata } from "next";
import JsonLd from "@/app/components/JsonLd";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { publicBookingPath } from "@/lib/booking/publicBookingPath";
import { salonJsonLd } from "@/lib/site/jsonLd";
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
      description
    `)
    .eq("slug", slug)
    .single();

  return data;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const salon = await getSalon(slug);

  if (!salon) {
    return createPageMetadata({
      title: "Salon inexistent",
      description: "Pagina salonului nu a fost găsită.",
      path: `/booking/salon/${slug}`,
      noIndex: true,
    });
  }

  const description =
    salon.description?.trim().slice(0, 160) ||
    `Programează-te online la ${salon.name}. Alege frizerul și ora disponibilă.`;

  return createPageMetadata({
    title: salon.name,
    description,
    path: `/booking/salon/${slug}`,
    keywords: [salon.name, "programări online frizerie", "salon"],
  });
}

export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const salon = await getSalon(slug);

  const { data: gallery } = await supabaseAdmin
    .from("salon_gallery")
    .select("*")
    .eq("tenant_id", salon?.id ?? "")
    .order("created_at");

  if (!salon) {
    return (
      <div className="max-w-xl mx-auto p-6">
        Salon inexistent.
      </div>
    );
  }

  const { data: barbers } = await supabaseAdmin
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
    .order("display_name");

  return (
    <>
      <JsonLd
        data={salonJsonLd({
          name: salon.name,
          slug: salon.slug,
          phone: salon.phone,
          address: salon.address,
          description: salon.description,
          logoUrl: salon.logo_url,
        })}
      />
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">
          {salon.logo_url && (
            <img
              src={salon.logo_url}
              alt={`Logo ${salon.name}`}
              className="w-24 h-24 rounded-2xl object-cover mx-auto mb-4"
            />
          )}

          <h1 className="text-3xl font-bold">{salon.name}</h1>

          {salon.phone && (
            <p className="text-gray-600 mt-3">📞 {salon.phone}</p>
          )}

          {salon.address && (
            <p className="text-gray-600">📍 {salon.address}</p>
          )}

          {salon.description && (
            <p className="text-gray-700 mt-4 max-w-2xl mx-auto">
              {salon.description}
            </p>
          )}

          {gallery && gallery.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Galerie</h2>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {gallery.map((img) => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    alt={`Galerie ${salon.name}`}
                    className="w-full h-48 object-cover rounded-xl border"
                  />
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
                href={publicBookingPath(slug, barber.slug)}
                className="block border rounded-2xl p-5 hover:shadow-md transition bg-white"
              >
                <div className="flex items-center gap-4">
                  {barber.avatar_url ? (
                    <img
                      src={barber.avatar_url}
                      alt={`${barber.display_name} — ${salon.name}`}
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
      </div>
    </>
  );
}

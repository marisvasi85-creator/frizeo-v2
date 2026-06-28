import BookingClient from "@/app/booking/[barberId]/components/BookingClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function Page({
  params,
}: {
  params: Promise<{
    slug: string;
    barberSlug: string;
  }>;
}) {
  const {
    slug,
    barberSlug,
  } = await params;

  const { data: salon } = await supabaseAdmin
  .from("tenants")
  .select(`
    id,
    name,
    logo_url,
    phone,
    address,
    description
  `)
    .eq("slug", slug)
    .single();

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

  const { data: barber } = await supabaseAdmin
  .from("barbers")
  .select(`
    id,
    display_name,
    avatar_url,
    bio,
    instagram_url
  `)
    .eq("tenant_id", salon.id)
    .eq("slug", barberSlug)
    .eq("active", true)
    .single();

  if (!barber) {
    return <div>Frizer inexistent</div>;
  }

  return (
  <div className="bg-white min-h-screen">

    <div className="max-w-5xl mx-auto px-4 py-8">

      <div className="bg-white border rounded-2xl p-6 mb-6">

        <div className="flex flex-col md:flex-row gap-6 items-center">

          {salon.logo_url && (
            <img
              src={salon.logo_url}
              alt=""
              className="w-24 h-24 rounded-2xl object-cover"
            />
          )}

          <div>

            <h1 className="text-3xl font-bold">
              {salon.name}
            </h1>

            {salon.phone && (
              <p className="text-gray-600 mt-2">
                📞 {salon.phone}
              </p>
            )}

            {salon.address && (
              <p className="text-gray-600">
                📍 {salon.address}
              </p>
            )}

          </div>

        </div>

        {salon.description && (
          <p className="mt-4 text-gray-700">
            {salon.description}
          </p>
        )}

      </div>

      <div className="bg-white border rounded-2xl p-6 mb-8">

        <div className="flex items-center gap-4">

          {barber.avatar_url ? (
            <img
              src={barber.avatar_url}
              alt=""
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gray-200" />
          )}

          <div>

            <h2 className="text-xl font-semibold">
              {barber.display_name}
            </h2>

            {barber.bio && (
              <p className="text-gray-600">
                {barber.bio}
              </p>
            )}

            {barber.instagram_url && (
              <a
                href={barber.instagram_url}
                target="_blank"
                className="text-blue-600 text-sm"
              >
                Instagram
              </a>
            )}

          </div>

        </div>

      </div>

      <BookingClient
        barberId={barber.id}
        barberName={barber.display_name}
      />

    </div>

  </div>
);}
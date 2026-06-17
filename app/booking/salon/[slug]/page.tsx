import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function SalonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: salon } = await supabaseAdmin
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
  <div className="max-w-4xl mx-auto p-6 space-y-8">

    <div className="bg-white rounded-2xl shadow-sm border p-6 text-center">

      {salon.logo_url && (
        <img
          src={salon.logo_url}
          alt=""
          className="w-24 h-24 rounded-2xl object-cover mx-auto mb-4"
        />
      )}

      <h1 className="text-3xl font-bold">
        {salon.name}
      </h1>

      {salon.phone && (
        <p className="text-gray-600 mt-3">
          📞 {salon.phone}
        </p>
      )}

      {salon.address && (
        <p className="text-gray-600">
          📍 {salon.address}
        </p>
      )}

      {salon.description && (
        <p className="text-gray-700 mt-4 max-w-2xl mx-auto">
          {salon.description}
        </p>
      )}

    </div>

    <div>

      <h2 className="text-2xl font-semibold mb-4">
        Alege frizerul
      </h2>

      <div className="grid gap-4">

        {barbers?.map((barber) => (
          <Link
            key={barber.id}
            href={`/booking/salon/${slug}/${barber.slug}`}
            className="
              block
              border
              rounded-2xl
              p-5
              hover:shadow-md
              transition
              bg-white
            "
          >

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

              <div className="flex-1">

                <h3 className="text-lg font-semibold">
                  {barber.display_name}
                </h3>

                {barber.bio && (
                  <p className="text-sm text-gray-600 mt-1">
                    {barber.bio}
                  </p>
                )}

                {barber.instagram_url && (
                  <p className="text-sm text-blue-600 mt-2">
                    Instagram
                  </p>
                )}

              </div>

              <div
                className="
                  px-4
                  py-2
                  rounded-lg
                  bg-black
                  text-white
                  text-sm
                "
              >
                Rezervă
              </div>

            </div>

          </Link>
        ))}

      </div>

    </div>

  </div>
);}
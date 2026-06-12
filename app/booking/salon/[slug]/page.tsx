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
    .select("id,name,slug")
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
      active
    `)
    .eq("tenant_id", salon.id)
    .eq("active", true)
    .order("display_name");

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">
          {salon.name}
        </h1>

        <p className="text-gray-500 mt-2">
          Alege frizerul
        </p>
      </div>

      <div className="space-y-3">
        {barbers?.map((barber) => (
          <Link
            key={barber.id}
            href={`/booking/${barber.id}`}
            className="
              block
              border
              rounded-xl
              p-4
              hover:bg-gray-50
              transition
            "
          >
            <div className="font-medium">
              {barber.display_name}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
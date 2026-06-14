import BookingClient from "@/app/booking/[barberId]/components/BookingClient";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function Page({
  params,
}: {
  params: Promise<{
    tenantSlug: string;
    barberSlug: string;
  }>;
}) {
  const {
    tenantSlug,
    barberSlug,
  } = await params;

  const { data: salon } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .single();

  if (!salon) {
    return <div>Salon inexistent</div>;
  }

  const { data: barber } = await supabaseAdmin
    .from("barbers")
    .select(`
      id,
      display_name
    `)
    .eq("tenant_id", salon.id)
    .eq("slug", barberSlug)
    .eq("active", true)
    .single();

  if (!barber) {
    return <div>Frizer inexistent</div>;
  }

  return (
    <BookingClient
      barberId={barber.id}
      barberName={barber.display_name}
    />
  );
}
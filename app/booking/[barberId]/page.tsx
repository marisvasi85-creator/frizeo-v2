import BookingClient from "./components/BookingClient";
import { createSupabaseServerReadonlyClient } from "@/lib/supabase/server-readonly";

export default async function Page(props: any) {
  const params = await props.params; // 🔥 FIX IMPORTANT
  const barberId = params.barberId;

  const supabase = createSupabaseServerReadonlyClient();

  const { data: barber } = await supabase
    .from("barbers")
    .select("tenant_id")
    .eq("id", barberId)
    .single();

  if (!barber) {
    return <div>Barber inexistent</div>;
  }

  return (
    <BookingClient
      barberId={barberId}
      tenantId={barber.tenant_id}
    />
  );
}
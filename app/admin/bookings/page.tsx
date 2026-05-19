import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export default async function AdminBookingsPage() {
  const barber = await getCurrentBarberInTenant();
  if (!barber) redirect("/login");

  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("bookings")
    .select(`
      id,
      date,
      start_time,
      end_time,
      client_name,
      cancel_token,
      barber_service_id,
      barber_services!barber_service_id ( display_name )
    `)
    .eq("barber_id", barber.id)
    .eq("status", "confirmed")
    .order("date", { ascending: true });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Programări</h1>

      {data?.map((b: any) => (
        <div key={b.id} className="border p-4 rounded-xl">
          <b>
            {b.start_time} - {b.end_time}
          </b>

          <p>{b.client_name}</p>

          <p className="text-sm opacity-70">
            {b.barber_services?.display_name}
          </p>

          <form action="/api/bookings/cancel" method="POST">
            <input type="hidden" name="token" value={b.cancel_token} />
            <button className="text-red-500">Anulează</button>
          </form>
        </div>
      ))}
    </div>
  );
}
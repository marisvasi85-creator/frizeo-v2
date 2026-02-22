import { redirect } from "next/navigation";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("*")
    .eq("barber_id", barber.id)
    .order("date", { ascending: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Dashboard – {barber.name}
      </h1>

      <div>
        <h2 className="font-semibold mb-2">Programări</h2>

        {bookings?.length === 0 && (
          <p>Nu există programări.</p>
        )}

        {bookings?.map((booking) => (
          <div
            key={booking.id}
            className="border p-3 rounded mb-2"
          >
            <div>
              {booking.date} – {booking.start_time}
            </div>
            <div>{booking.customer_name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

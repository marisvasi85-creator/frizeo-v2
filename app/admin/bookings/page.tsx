// app/admin/bookings/page.tsx

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentBarberInTenant } from "@/lib/supabase/getCurrentBarberInTenant";

export default async function AdminBookingsPage() {
  const barber = await getCurrentBarberInTenant();

  if (!barber) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
  .from("bookings")
  .select(`
    id,
    date,
    start_time,
    end_time,
    client_name,
    client_phone,
    service_id,
    services!service_id ( name )
  `)
  .eq("barber_id", barber.id)
  .order("date", { ascending: true })
  .order("start_time", { ascending: true });
  if (error) {
    return <p>Eroare: {error.message}</p>;
  }

  const grouped: Record<string, any[]> = {};

  (data || []).forEach((b) => {
    if (!grouped[b.date]) {
      grouped[b.date] = [];
    }
    grouped[b.date].push(b);
  });

  return (
    <div style={{ padding: 24 }}>
      <h1>📅 Programări</h1>

      {Object.entries(grouped).length === 0 && (
        <p>Nu există programări.</p>
      )}

      {Object.entries(grouped).map(([day, bookings]) => (
        <div key={day} style={{ marginTop: 24 }}>
          <h3>{day}</h3>

          {bookings.map((b: any) => (
            <div key={b.id} style={{ paddingLeft: 12, marginTop: 6 }}>
              <b>
                {b.start_time} – {b.end_time}
              </b>{" "}
              — {b.client_name}
              {b.services?.length > 0 && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>
                  ({b.services[0].name})
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
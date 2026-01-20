import { supabaseServer } from "@/lib/supabase/server";

type Booking = {
  id: string;
  booking_date: string;
  booking_time: string;
  client_name: string;
  client_phone: string;
  status: string;
  barbers: {
    display_name: string;
  } | null;
};

export default async function AdminBookingsPage() {
  const supabase = supabaseServer();

  /* 1️⃣ user logat */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p>Neautorizat</p>;
  }

  /* 2️⃣ tenant-ul userului */
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!tenant) {
    return <p>Tenant inexistent</p>;
  }

  /* 3️⃣ programările */
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      id,
      booking_date,
      booking_time,
      client_name,
      client_phone,
      status,
      barbers (
        display_name
      )
    `)
    .eq("tenant_id", tenant.id)
    .order("booking_date", { ascending: false })
    .order("booking_time", { ascending: true });

  return (
    <div style={{ padding: 24 }}>
      <h1>Programări</h1>

      {!bookings?.length && <p>Nu există programări</p>}

      <table border={1} cellPadding={8} style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Data</th>
            <th>Ora</th>
            <th>Frizer</th>
            <th>Client</th>
            <th>Telefon</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {bookings?.map((b) => (
            <tr key={b.id}>
              <td>{b.booking_date}</td>
              <td>{b.booking_time}</td>
              <td>{b.barbers?.[0]?.display_name || "-"}</td>
              <td>{b.client_name}</td>
              <td>{b.client_phone}</td>
              <td>{b.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

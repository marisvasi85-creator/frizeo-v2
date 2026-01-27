"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Booking = {
  id: string;
  booking_date: string;
  booking_time: string;
  client_name: string;
  services: {
    name: string;
  }[];
};


export default function AdminBookingsPage() {
  const [grouped, setGrouped] = useState<Record<string, Booking[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  async function loadBookings() {
    setLoading(true);

    console.log("=== LOAD BOOKINGS START ===");

    // 🔍 1. verificăm userul curent
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log("AUTH USER:", user);
    console.log("AUTH ERROR:", authError);

    // 🔴 dacă user e null, ne oprim AICI
    if (!user) {
      console.error("❌ USER IS NULL → NU ești logat în Supabase");
      setLoading(false);
      return;
    }

    // 🔍 2. query bookings
    const { data, error } = await supabase
  .from("bookings")
  .select(`
    id,
    booking_date,
    booking_time,
    client_name,
    services:services!bookings_service_id_fkey (
      name
    )
  `)
  .order("booking_date", { ascending: true })
  .order("booking_time", { ascending: true });


    console.log("BOOKINGS DATA:", data);
    console.log("BOOKINGS ERROR:", error);

    if (error) {
      console.error("❌ EROARE BOOKINGS:", error);
      setLoading(false);
      return;
    }

    const groupedByDay: Record<string, Booking[]> = {};

    (data || []).forEach((b) => {
      if (!groupedByDay[b.booking_date]) {
        groupedByDay[b.booking_date] = [];
      }
      groupedByDay[b.booking_date].push(b);
    });

    console.log("GROUPED:", groupedByDay);

    setGrouped(groupedByDay);
    setLoading(false);
  }

  if (loading) {
    return <p style={{ padding: 24 }}>Se încarcă programările…</p>;
  }

  if (Object.keys(grouped).length === 0) {
    return <p style={{ padding: 24 }}>Nu există programări.</p>;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>📅 Programări</h1>

      {Object.entries(grouped).map(([day, bookings]) => (
        <div key={day} style={{ marginTop: 24 }}>
          <h3>{day}</h3>

          {bookings.map((b) => (
            <div key={b.id} style={{ paddingLeft: 12, marginTop: 6 }}>
              <b>{b.booking_time}</b> — {b.client_name}
              {b.services.length > 0 && (
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

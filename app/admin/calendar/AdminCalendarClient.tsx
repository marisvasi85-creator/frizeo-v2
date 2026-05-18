"use client";

import { useEffect, useState } from "react";
import CalendarGrid from "./components/CalendarGrid";

export default function AdminCalendarClient({ barberId }: { barberId: string }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    const [bRes, oRes] = await Promise.all([
      fetch("/api/bookings/list"),
      fetch("/api/barber-overrides"),
    ]);

    const bData = await bRes.json();
    const oData = await oRes.json();

    setBookings(bData.bookings || []);
    setOverrides(oData.overrides || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <CalendarGrid
      bookings={bookings}
      overrides={overrides}
      barberId={barberId}
      onRefresh={loadData}
    />
  );
}
"use client";

import { useEffect, useState } from "react";
import CalendarGrid from "./components/CalendarGrid";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

    console.log("📦 BOOKINGS API:", bData);
    console.log("📦 OVERRIDES API:", oData);

    setBookings(bData.bookings || []);
    setOverrides(oData.overrides || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // 🔥 REALTIME GLOBAL (CORECT)
  useEffect(() => {
    const channel = supabase
      .channel("admin-bookings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
        },
        (payload) => {
          console.log("🔄 REALTIME EVENT:", payload);

          // 🔥 NU mai facem manual update → reload sigur
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="text-white p-4">
        Se încarcă calendar...
      </div>
    );
  }

  return (
    <CalendarGrid
      bookings={bookings}
      overrides={overrides}
      barberId={barberId}
      onRefresh={loadData}
    />
  );
}
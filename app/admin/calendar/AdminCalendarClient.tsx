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
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]); // 🔥 NOU
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);

    const [bRes, oRes, sRes] = await Promise.all([
      fetch("/api/bookings/list"),
      fetch("/api/barber-overrides"),
      fetch("/api/barber-weekly-schedule"), // 🔥 NOU
    ]);

    const bData = await bRes.json();
    const oData = await oRes.json();
    const sData = await sRes.json(); // 🔥 NOU

    console.log("📦 BOOKINGS API:", bData);
    console.log("📦 OVERRIDES API:", oData);
    console.log("📦 SCHEDULE API:", sData); // 🔥 DEBUG

    setBookings(bData.bookings || []);
    setOverrides(oData.overrides || []);
    setWeeklySchedule(sData || []); // 🔥 CRITIC

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // 🔥 REALTIME GLOBAL
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

        setBookings((prev) => {
          // 🔥 INSERT
          if (payload.eventType === "INSERT") {
            return [...prev, payload.new];
          }

          // 🔥 UPDATE
          if (payload.eventType === "UPDATE") {
            return prev.map((b) =>
              b.id === payload.new.id ? payload.new : b
            );
          }

          // 🔥 DELETE
          if (payload.eventType === "DELETE") {
            return prev.filter((b) => b.id !== payload.old.id);
          }

          return prev;
        });
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
      weeklySchedule={weeklySchedule} // 🔥 ASTA LIPSEA
      barberId={barberId}
      onRefresh={loadData}
    />
  );
}
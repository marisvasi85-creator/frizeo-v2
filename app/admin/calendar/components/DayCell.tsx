"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function formatLocalDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// 🔥 Supabase client (frontend)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DayCell({
  date,
  bookings = [],
  overrides = [],
  onClick,
}: any) {
  const today = formatLocalDate(new Date());

  const isToday = date === today;
  const isPast = date < today;

  const [localBookings, setLocalBookings] = useState<any[]>([]);

  // 🔥 INIT BOOKINGS
  useEffect(() => {
    setLocalBookings(bookings);
  }, [bookings]);

  // 🔥 REALTIME SUBSCRIPTION
  useEffect(() => {
    const channel = supabase
      .channel("bookings-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
        },
        (payload) => {
          console.log("REALTIME EVENT:", payload);

          setLocalBookings((prev) => {
            // 🔥 insert
            if (payload.eventType === "INSERT") {
              return [...prev, payload.new];
            }

            // 🔥 update
            if (payload.eventType === "UPDATE") {
              return prev.map((b) =>
                b.id === payload.new.id ? payload.new : b
              );
            }

            // 🔥 delete
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

  // 🔥 DEBUG HARD
  console.log("CELL DATE:", date);
  console.log("ALL BOOKINGS:", localBookings);

  // 🔥 FILTER CORECT (FARA DATE CONVERSION)
  const dayBookings = localBookings.filter(
    (b: any) => b.date === date && b.status !== "cancelled"
  );

  console.log("BOOKINGS FOR DAY:", dayBookings);

  const override = overrides.find((o: any) => o.date === date);

  let bg = "bg-zinc-900";

  if (override?.is_closed) bg = "bg-red-500/20";
  else if (dayBookings.length > 0) bg = "bg-green-500/20";

  return (
    <div
      onClick={() => {
        if (!isPast) onClick();
      }}
      className={`
        relative p-3 rounded-lg transition-all duration-150
        ${bg}
        ${isToday ? "border border-blue-500" : ""}
        ${
          isPast
            ? "opacity-30 cursor-not-allowed"
            : "cursor-pointer hover:bg-white/10"
        }
        group
      `}
    >
      {/* 🔥 zi */}
      <div className="text-sm font-medium text-white">
        {date.split("-")[2]}
      </div>

      {/* 🔥 badge */}
      {dayBookings.length > 0 && (
        <div className="absolute bottom-1 right-1 text-[10px] bg-white text-black px-1.5 py-[1px] rounded">
          {dayBookings.length}
        </div>
      )}

      {/* 🔥 TOOLTIP HOVER */}
      {dayBookings.length > 0 && (
        <div className="
          absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2
          hidden group-hover:block
          bg-black text-white text-xs p-2 rounded shadow-lg w-40
        ">
          {dayBookings.map((b: any) => (
            <div key={b.id} className="border-b border-white/10 py-1">
              {b.start_time?.slice(0, 5)} - {b.client_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
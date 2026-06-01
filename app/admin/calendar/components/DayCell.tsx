"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function formatLocalDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DayCell({
  date,
  bookings = [],
  overrides = [],
  weeklySchedule = [], // 🔥 NOU
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


  // =========================
  // 🔥 BOOKINGS PE ZI
  // =========================
  const dayBookings = localBookings.filter(
    (b: any) => b.date === date && b.status !== "cancelled"
  );

  // =========================
  // 🔥 OVERRIDE
  // =========================
  const override = overrides.find((o: any) => o.date === date);

  // =========================
  // 🔥 WEEKLY SCHEDULE
  // =========================
  const jsDay = new Date(date).getDay();
  const day = jsDay === 0 ? 7 : jsDay;

  const schedule = weeklySchedule.find(
    (s: any) => s.day_of_week === day
  );

  const isWorking = schedule?.is_working ?? false;

  // =========================
  // 🔥 ZI BLOCATĂ?
  // =========================
  const isClosed =
    override?.is_closed || !isWorking;

  // =========================
  // 🔥 UI
  // =========================
  let bg = "bg-zinc-900";

  if (isClosed) bg = "bg-red-500/20";
  else if (dayBookings.length > 0) bg = "bg-green-500/20";

  return (
  <div
    onClick={() => {
      if (!isPast && !isClosed) onClick();
    }}
    className={`
      relative p-3 rounded-xl transition-all duration-200

      ${isToday ? "border border-blue-500" : ""}

      ${
        isPast
          ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          : ""
      }

      ${
        isClosed && !isPast
          ? "bg-red-500/20 text-red-300 cursor-not-allowed"
          : ""
      }

      ${
        !isClosed && dayBookings.length > 0 && !isPast
          ? "bg-green-500/20"
          : ""
      }

      ${
        !isPast && !isClosed
          ? "cursor-pointer hover:scale-[1.05] hover:bg-white/10"
          : ""
      }

      group
    `}
  >
    {/* 🔥 zi */}
    <div className="text-sm font-medium text-white">
      {date.split("-")[2]}
    </div>

    {/* 🔥 BADGE BOOKINGS */}
    {dayBookings.length > 0 && !isClosed && !isPast && (
      <div className="absolute bottom-1 right-1 text-[10px] bg-white text-black px-1.5 py-[1px] rounded">
        {dayBookings.length}
      </div>
    )}

    {/* 🔥 TOOLTIP */}
    {dayBookings.length > 0 && !isClosed && !isPast && (
      <div
        className="
          absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2
          hidden group-hover:block
          bg-black text-white text-xs p-2 rounded shadow-lg w-40
        "
      >
        {dayBookings.map((b: any) => (
          <div key={b.id} className="border-b border-white/10 py-1">
            {b.start_time?.slice(0, 5)} - {b.client_name}
          </div>
        ))}
      </div>
    )}

    {/* ========================= */}
    {/* 🔥 FINAL DE LUNĂ ALERT */}
    {/* ========================= */}
    {(() => {
      const d = new Date(date);
      const lastDay = new Date(
        d.getFullYear(),
        d.getMonth() + 1,
        0
      ).getDate();

      if (d.getDate() === lastDay && !isPast) {
        return (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] bg-yellow-400 text-black px-2 py-[1px] rounded">
            → luna viitoare
          </div>
        );
      }

      return null;
    })()}
  </div>
);
}
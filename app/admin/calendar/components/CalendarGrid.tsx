"use client";

import { useState } from "react";
import DayCell from "./DayCell";
import DayPanelModal from "./DayPanelModal";

export default function CalendarGrid({
  bookings,
  overrides,
  barberId,
  weeklySchedule, // 🔥 NOU
  onRefresh,
}: any) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  const days = generateCalendarDays(currentDate);

  function nextMonth() {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  }

  function prevMonth() {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  }

  return (
    <>
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth}>◀</button>

        <h2 className="text-lg font-semibold capitalize">
          {currentDate.toLocaleDateString("ro-RO", {
            month: "long",
            year: "numeric",
          })}
        </h2>

        <button onClick={nextMonth}>▶</button>
      </div>

      {/* ZILE SAPTAMANA */}
      <div className="grid grid-cols-7 gap-2 mb-2 text-sm text-center text-gray-400">
        {["L", "Ma", "Mi", "J", "V", "S", "D"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* GRID */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, i) =>
          date ? (
            <DayCell
              key={date}
              date={date}
              bookings={bookings}
              overrides={overrides}
              weeklySchedule={weeklySchedule} // 🔥 CRITIC
              onClick={() => setSelectedDate(date)}
            />
          ) : (
            <div key={i} />
          )
        )}
      </div>

      {/* MODAL */}
      {selectedDate && (
        <DayPanelModal
          date={selectedDate}
          barberId={barberId}
          bookings={bookings}
          overrides={overrides}
          onClose={() => setSelectedDate(null)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

// 🔥 CALENDAR REAL
function formatLocalDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function generateCalendarDays(date: Date) {
  const days: (string | null)[] = [];

  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // 🔥 luni = 0
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;

  for (let i = 0; i < startDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push(formatLocalDate(d));
  }

  return days;
}
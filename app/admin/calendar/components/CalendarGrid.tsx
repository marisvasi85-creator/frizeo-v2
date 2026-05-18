"use client";

import { useState } from "react";
import DayCell from "./DayCell";
import DayPanelModal from "./DayPanelModal";

export default function CalendarGrid({
  bookings = [],
  overrides = [],
  barberId,
  onRefresh,
}: {
  bookings?: any[];
  overrides?: any[];
  barberId: string;
  onRefresh: () => void;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const days = generateMonthDays();

  return (
    <>
      <div className="grid grid-cols-7 gap-2">
        {days.map((date) => (
          <DayCell
            key={date}
            date={date}
            bookings={bookings}
            overrides={overrides}
            onClick={() => setSelectedDate(date)}
          />
        ))}
      </div>

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

function generateMonthDays() {
  const days: string[] = [];
  const now = new Date();

  for (let i = 1; i <= 31; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), i);
    days.push(d.toISOString().split("T")[0]);
  }

  return days;
}
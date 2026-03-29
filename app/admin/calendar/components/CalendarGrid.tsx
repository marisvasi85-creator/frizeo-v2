"use client";

import React, { useEffect, useState } from "react";
import DayCell from "./DayCell";

type Props = {
  barberId: string;
  year: number;
  month: number;
  onSelectDate: (date: string) => void;
};

export default function CalendarGrid({
  barberId,
  year,
  month,
  onSelectDate,
}: Props) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;

  const [availability, setAvailability] = useState<
    Record<string, boolean>
  >({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAvailability() {
    setLoading(true);

    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;

    const res = await fetch(
      `/api/availability?barberId=${barberId}&from=${from}&to=${to}`
    );

    const data = await res.json();

    setAvailability(data.availability || {});
    setLoading(false);
  }

  useEffect(() => {
    loadAvailability();
  }, [barberId, year, month, daysInMonth]);

  const cells: React.ReactNode[] = [];

  for (let i = 0; i < startWeekday; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;

    const isAvailable = availability[dateStr] === true;

    const today = new Date();
    const isToday =
      dateStr ===
      `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(today.getDate()).padStart(2, "0")}`;

    cells.push(
      <DayCell
        key={dateStr}
        date={dateStr}
        dayNumber={day}
        isAvailable={isAvailable}
        isSelected={selectedDate === dateStr}
        isToday={isToday}
        onClick={() => {
          if (!isAvailable) return;

          setSelectedDate(dateStr);
          onSelectDate(dateStr);
        }}
      />
    );
  }

  return (
    <div>
      {loading && (
        <p style={{ marginTop: 10, color: "#666" }}>
          Se încarcă calendarul...
        </p>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
          marginTop: 12,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
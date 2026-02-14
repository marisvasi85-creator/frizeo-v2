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
  const startWeekday = (firstDay.getDay() + 6) % 7; // luni = 0

  const [availability, setAvailability] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(
      daysInMonth
    ).padStart(2, "0")}`;

    fetch(
      `/api/availability?barberId=${barberId}&from=${from}&to=${to}`
    )
      .then((res) => res.json())
      .then((data) => {
        setAvailability(data.availability || {});
      });
  }, [barberId, year, month, daysInMonth]);

  const cells: React.ReactNode[] = [];

  // zile goale înainte de 1
  for (let i = 0; i < startWeekday; i++) {
    cells.push(<div key={`empty-${i}`} />);
  }

  // zilele lunii
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(
      2,
      "0"
    )}-${String(day).padStart(2, "0")}`;

    const isAvailable = availability[dateStr] === true;

    cells.push(
      <DayCell
        key={dateStr}
        date={dateStr}
        dayNumber={day}
        isAvailable={isAvailable}
        onClick={() => {
          if (isAvailable) {
            onSelectDate(dateStr);
          }
        }}
      />
    );
  }

  return (
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
  );
}

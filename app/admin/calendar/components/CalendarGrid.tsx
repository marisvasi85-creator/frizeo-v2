"use client";
import React from "react";
import DayCell from "./DayCell";


type Props = {
  year: number;
  month: number; // 0–11
  onSelectDate: (date: string) => void;
};

export default function CalendarGrid({
  year,
  month,
  onSelectDate,
}: Props) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7; // luni = 0

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

    cells.push(
      <DayCell
        key={dateStr}
        date={dateStr}
        dayNumber={day}
        onClick={() => onSelectDate(dateStr)}
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

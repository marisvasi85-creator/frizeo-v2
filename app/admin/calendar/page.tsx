"use client";

import { useState } from "react";
import CalendarGrid from "./components/CalendarGrid";
import OverrideModal from "./components/OverrideModal";

export default function AdminCalendarPage() {
  const today = new Date();
  const [selectedDate, setSelectedDate] =
    useState<string | null>(null);

  const barberId = "EB_ID"; // ← înlocuiești cu barber-ul logat

  return (
    <div style={{ padding: 20 }}>
      <h1>Calendar</h1>

      <CalendarGrid
        year={today.getFullYear()}
        month={today.getMonth()}
        onSelectDate={(date) => setSelectedDate(date)}
      />

      {selectedDate && (
        <OverrideModal
          barberId={barberId}
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          onSaved={() => {
            /* refresh vizual dacă vrei */
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import CalendarGrid from "./components/CalendarGrid";
import OverrideModal from "./components/OverrideModal";

type Props = {
  barberId: string;
};

export default function AdminCalendarClient({ barberId }: Props) {
  const today = new Date();

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null);

  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div style={{ padding: 20 }}>
      <h1>Calendar</h1>

      <CalendarGrid
        key={refreshKey}
        barberId={barberId}
        year={today.getFullYear()}
        month={today.getMonth()}
        onSelectDate={setSelectedDate}
      />

      {selectedDate && (
        <OverrideModal
          barberId={barberId}
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          onSaved={() => {
            setSelectedDate(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

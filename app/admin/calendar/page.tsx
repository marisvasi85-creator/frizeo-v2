"use client";

import { useEffect, useState } from "react";

type Slot = {
  time: string;
  status: "free" | "occupied";
  client_name: string | null;
  client_phone: string | null;
};

export default function AdminCalendarPage() {
  const barberId = "d0bc5fec-f37a-4e8a-94ab-b3ef9880374c"; // temporar
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    if (!date) return;

    fetch(
      `/api/admin/calendar?barberId=${barberId}&date=${date}`
    )
      .then(res => res.json())
      .then(data => setSlots(data.slots || []));
  }, [date]);

  return (
    <div style={{ padding: 24 }}>
      <h1>📅 Calendar admin</h1>

      <label>Data</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <br /><br />

      {slots.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {slots.map((slot) => (
            <div
              key={slot.time}
              style={{
                padding: 8,
                borderRadius: 6,
                background:
                  slot.status === "occupied"
                    ? "#ffd6d6"
                    : "#d6ffd6",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <strong>{slot.time}</strong>

              {slot.status === "occupied" ? (
                <span>
                  🔴 {slot.client_name} ({slot.client_phone})
                </span>
              ) : (
                <span>🟢 liber</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

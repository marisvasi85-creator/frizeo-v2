"use client";

import { useState } from "react";
import type { Override } from "@/app/types/override";

type Props = {
  barberId: string;
  date: string;
  existingOverride: Override | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function OverrideModal({
  barberId,
  date,
  existingOverride,
  onClose,
  onSaved,
}: Props) {
  const [mode, setMode] = useState<"day" | "slot">(
    existingOverride?.is_closed ? "day" : "slot"
  );

  const [startTime, setStartTime] = useState(
    existingOverride?.start_time ?? "09:00"
  );
  const [endTime, setEndTime] = useState(
    existingOverride?.end_time ?? "17:00"
  );

  const handleSave = async () => {
    await fetch("/api/barber-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barber_id: barberId,
        date,
        is_closed: mode === "day",
        start_time: mode === "slot" ? startTime : null,
        end_time: mode === "slot" ? endTime : null,
      }),
    });

    onSaved();
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Override {date}</h3>

        <label>
          <input
            type="radio"
            checked={mode === "day"}
            onChange={() => setMode("day")}
          />
          Zi închisă
        </label>

        <label>
          <input
            type="radio"
            checked={mode === "slot"}
            onChange={() => setMode("slot")}
          />
          Interval orar
        </label>

        {mode === "slot" && (
          <div>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        )}

        <button onClick={handleSave}>Salvează</button>
        <button onClick={onClose}>Anulează</button>
      </div>
    </div>
  );
}

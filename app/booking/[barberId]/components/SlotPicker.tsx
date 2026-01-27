"use client";

import { useState } from "react";

type Props = {
  slots: string[];
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
  loading?: boolean;
};

export default function SlotPicker({
  slots,
  selectedSlot,
  onSelect,
  loading,
}: Props) {
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);

  const handleClick = (slot: string) => {
    setPendingSlot(slot);
    onSelect(slot);
  };

  if (loading) {
    return <p>Se încarcă sloturile...</p>;
  }

  if (!slots.length) {
    return <p>Nu mai sunt sloturi disponibile</p>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {slots.map((slot) => {
        const disabled = pendingSlot === slot;

        return (
          <button
            key={slot}
            disabled={disabled}
            onClick={() => handleClick(slot)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background:
                selectedSlot === slot ? "#111" : "#fff",
              color:
                selectedSlot === slot ? "#fff" : "#000",
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}

"use client";

type Props = {
  slots: string[];
  occupiedSlots: string[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  loading: boolean;
};

export default function SlotPicker({
  slots,
  occupiedSlots,
  selectedSlot,
  onSelectSlot,
  loading,
}: Props) {
  if (loading) {
    return <p>Se încarcă sloturile...</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => {
        const isOccupied = occupiedSlots.includes(slot);
        const isSelected = selectedSlot === slot;

        return (
          <button
            key={slot}
            disabled={isOccupied}
            onClick={() => onSelectSlot(slot)}
            className={`
              p-2 rounded border text-sm
              ${isOccupied ? "bg-gray-300 cursor-not-allowed" : ""}
              ${isSelected ? "bg-black text-white" : ""}
              ${!isOccupied && !isSelected ? "hover:bg-gray-100" : ""}
            `}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}

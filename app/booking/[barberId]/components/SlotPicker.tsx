"use client";

type Props = {
  barberId: string;
  date: string;
  slots: string[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  loading: boolean;
};


export default function SlotPicker({
  slots,
  selectedSlot,
  onSelectSlot,
  loading,
}: Props) {
  if (loading) return <p>Se încarcă sloturile…</p>;
  if (!slots.length) return <p>Nu mai sunt sloturi disponibile</p>;

  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => (
        <button
          key={slot}
          onClick={() => onSelectSlot(slot)}
          className={`border px-3 py-2 rounded ${
            selectedSlot === slot ? "bg-black text-white" : "bg-white"
          }`}
        >
          {slot}
        </button>
      ))}
    </div>
  );
}

"use client";

type Slot = {
  time: string;
  occupied: boolean;
  booking?: any;
};

export default function SlotPicker({
  slots,
  selected,
  onSelect,
  onBookingClick,
  loading = false,
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (slot: string) => void;
  onBookingClick?: (booking: any) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 mt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-10 bg-zinc-700 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {slots.map((s) => {
        const isSelected = selected === s.time;

        if (s.occupied) {
          return (
            <button
              key={`occupied-${s.time}-${s.booking?.id}`}
              onClick={() => onBookingClick?.(s.booking)}
              className="p-3 rounded-xl bg-red-500 text-white text-left"
            >
              <div className="font-semibold">{s.time}</div>
              <div className="text-xs">{s.booking?.client_name}</div>
            </button>
          );
        }

        return (
          <button
            key={`free-${s.time}`}
            onClick={() => onSelect(s.time)}
            className={`
              p-3 rounded-xl border
              ${
                isSelected
                  ? "bg-white text-black"
                  : "bg-zinc-800 text-white border-zinc-700"
              }
            `}
          >
            {s.time}
          </button>
        );
      })}
    </div>
  );
}
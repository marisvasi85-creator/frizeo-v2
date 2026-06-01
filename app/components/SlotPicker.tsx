export default function SlotPicker({
  slots,
  selected,
  onSelect,
  loading = false,
}: {
  slots: string[];
  selected: string | null;
  onSelect: (slot: string) => void;
  loading?: boolean;
}) {
  // 🔥 SKELETON
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-3 mt-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-10 rounded-xl bg-gray-200 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {slots.map((slot, index) => {
        const isSelected = selected === slot;

        return (
          <button
            key={`${slot}-${index}`}
            onClick={() => onSelect(slot)}
            className={`
              p-3 rounded-xl border text-sm font-medium transition
              
              ${
                isSelected
                  ? "bg-black text-white border-black"
                  : "bg-white text-black border-gray-300 hover:bg-gray-100 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 dark:hover:bg-zinc-700"
              }
            `}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}
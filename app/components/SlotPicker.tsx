export default function SlotPicker({
  slots,
  selected,
  onSelect,
}: {
  slots: string[];
  selected: string | null;
  onSelect: (slot: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      {slots.map((slot, index) => (
        <button
          key={`${slot}-${index}`} // 🔥 FIX KEY
          onClick={() => onSelect(slot)}
          className={`p-3 rounded border ${
            selected === slot ? "bg-black text-white" : ""
          }`}
        >
          {slot}
        </button>
      ))}
    </div>
  );
}
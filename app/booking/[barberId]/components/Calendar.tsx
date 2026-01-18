"use client";

export default function Calendar({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: string | null;
  onSelectDate: (d: string) => void;
}) {
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div>
      {days.map((d) => (
        <button
          key={d}
          onClick={() => onSelectDate(d)}
          style={{
            background: d === selectedDate ? "#333" : "#eee",
            color: d === selectedDate ? "#fff" : "#000",
            marginBottom: 6,
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

"use client";

type Props = {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

export default function Calendar({
  selectedDate,
  onSelectDate,
}: Props) {
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {days.map((d) => (
        <button
          key={d}
          onClick={() => onSelectDate(d)}
          style={{
            padding: 8,
            background: d === selectedDate ? "#111" : "#eee",
            color: d === selectedDate ? "#fff" : "#000",
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

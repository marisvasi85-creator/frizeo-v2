"use client";

type Props = {
  date: string; // YYYY-MM-DD
  dayNumber: number;
  onClick: () => void;
};

export default function DayCell({
  date,
  dayNumber,
  onClick,
}: Props) {
  return (
    <div
      onClick={onClick}
      style={{
        border: "1px solid #ddd",
        padding: 8,
        minHeight: 60,
        cursor: "pointer",
        borderRadius: 6,
      }}
    >
      <strong>{dayNumber}</strong>
    </div>
  );
}

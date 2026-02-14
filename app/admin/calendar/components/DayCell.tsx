"use client";

type Props = {
  date: string;
  dayNumber: number;
  isAvailable: boolean;
  onClick: () => void;
};

export default function DayCell({
  date,
  dayNumber,
  isAvailable,
  onClick,
}: Props) {
  return (
    <div
      onClick={isAvailable ? onClick : undefined}
      style={{
        padding: 10,
        borderRadius: 6,
        textAlign: "center",
        cursor: isAvailable ? "pointer" : "not-allowed",
        backgroundColor: isAvailable ? "#e8f5e9" : "#f5f5f5",
        color: isAvailable ? "#000" : "#999",
        border: "1px solid #ddd",
        userSelect: "none",
      }}
    >
      {dayNumber}
    </div>
  );
}

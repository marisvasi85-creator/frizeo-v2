"use client";

type Props = {
  date: string;
  dayNumber: number;
  isAvailable: boolean;
  isSelected?: boolean;
  isToday?: boolean;
  onClick: () => void;
};

export default function DayCell({
  dayNumber,
  isAvailable,
  isSelected,
  isToday,
  onClick,
}: Props) {
  let bg = "#f5f5f5";
  let color = "#999";
  let border = "1px solid #ddd";

  if (isAvailable) {
    bg = "#e8f5e9";
    color = "#000";
  }

  if (isToday) {
    border = "2px solid #2196f3";
  }

  if (isSelected) {
    bg = "#2196f3";
    color = "#fff";
  }

  return (
    <div
      onClick={isAvailable ? onClick : undefined}
      style={{
        padding: 12,
        borderRadius: 8,
        textAlign: "center",
        cursor: isAvailable ? "pointer" : "not-allowed",
        backgroundColor: bg,
        color,
        border,
        userSelect: "none",
        transition: "all 0.2s",
        fontWeight: isSelected ? "bold" : "normal",
      }}
    >
      {dayNumber}
    </div>
  );
}
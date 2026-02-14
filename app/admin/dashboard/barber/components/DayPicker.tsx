"use client";

type Props = {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
};

export default function DayPicker({ value, onChange }: Props) {
  return (
    <div style={{ marginBottom: 12 }}>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

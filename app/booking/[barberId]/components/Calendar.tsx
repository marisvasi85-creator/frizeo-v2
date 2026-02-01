"use client";

type Props = {
  date: string | null;
  onChange: (date: string) => void;
  disabled?: boolean;
};

export default function Calendar({ date, onChange, disabled }: Props) {
  return (
    <input
      type="date"
      value={date ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="border rounded p-2 w-full"
    />
  );
}

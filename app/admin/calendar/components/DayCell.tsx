"use client";

export default function DayCell({
  date,
  bookings = [],
  overrides = [],
  onClick,
}: any) {
  const dayBookings = bookings.filter((b: any) => b.date === date);
  const override = overrides.find((o: any) => o.date === date);

  let bg = "bg-zinc-900";

  if (override?.is_closed) bg = "bg-red-500/20";
  else if (dayBookings.length > 0) bg = "bg-green-500/20";

  return (
    <div onClick={onClick} className={`p-3 rounded cursor-pointer ${bg}`}>
      <div>{date.split("-")[2]}</div>
      <div className="text-xs">{dayBookings.length}</div>
    </div>
  );
}
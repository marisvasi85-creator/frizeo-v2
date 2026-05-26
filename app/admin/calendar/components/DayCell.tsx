"use client";

export default function DayCell({
  date,
  bookings = [],
  overrides = [],
  onClick,
}: any) {
  const today = new Date().toISOString().split("T")[0];

  const isToday = date === today;
  const isPast = date < today;

  const dayBookings = bookings.filter((b: any) => b.date === date);
  const override = overrides.find((o: any) => o.date === date);

  let bg = "bg-zinc-900";

  if (override?.is_closed) bg = "bg-red-500/20";
  else if (dayBookings.length > 0) bg = "bg-green-500/20";

  return (
    <div
      onClick={() => {
        if (!isPast) onClick();
      }}
      className={`
        relative p-3 rounded transition
        ${bg}
        ${isToday ? "border border-blue-500" : ""}
        ${isPast ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-white/10"}
      `}
    >
      {/* zi */}
      <div className="text-sm font-medium">
        {date.split("-")[2]}
      </div>

      {/* nr programări */}
      {dayBookings.length > 0 && (
        <div className="absolute bottom-1 right-1 text-xs bg-white text-black px-1 rounded">
          {dayBookings.length}
        </div>
      )}
    </div>
  );
}
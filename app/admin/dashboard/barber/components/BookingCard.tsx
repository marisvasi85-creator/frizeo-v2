"use client";

import { useState } from "react";
import BookingDetailsModal from "./BookingDetailsModal";

type Booking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  status: string;
};
const STATUS_COLORS: Record<string, string> = {
  confirmed: "#16a34a",     // verde
  rescheduled: "#ea580c",   // portocaliu
  canceled: "#dc2626",      // roșu
};

export default function BookingCard({
  booking,
  onChanged,
}: {
  booking: Booking;
  onChanged: () => void;
}) {
  const statusColor = STATUS_COLORS[booking.status] ?? "#6b7280";
  const [open, setOpen] = useState(false);
  const isCancelled = booking.status === "cancelled";

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        style={{
          padding: 12,
          marginBottom: 8,
          borderRadius: 6,
          border: "1px solid #ddd",
          opacity: isCancelled ? 0.5 : 1,
          cursor: "pointer",
        }}
      >
        <strong>
          {booking.start_time} – {booking.end_time}
        </strong>
        <div>{booking.client_name}</div>
        <div>{booking.client_phone}</div>
        <div
  style={{
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    backgroundColor: statusColor,
    color: "white",
    marginBottom: 6,
  }}
>
  {booking.status}
</div>

        {isCancelled && <em>Anulată</em>}
      </div>

      {open && (
        <BookingDetailsModal
          booking={booking}
          onClose={() => setOpen(false)}
          onCancelled={onChanged}
        />
      )}
    </>
  );
}

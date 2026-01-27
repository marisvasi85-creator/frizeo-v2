"use client";

import { useEffect, useState } from "react";
import BookingCard from "./BookingCard";

type Props = {
  barberId: string;
  date: string;
};

export default function BookingList({ barberId, date }: Props) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);

    fetch(
      `/api/bookings/list?barberId=${barberId}&date=${date}`
    )
      .then((res) => res.json())
      .then((data) => {
        setBookings(data.bookings || []);
      })
      .finally(() => setLoading(false));
  }, [barberId, date]);

  const markCancelled = (id: string) => {
    setBookings((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, status: "cancelled" } : b
      )
    );
  };

  if (loading) return <p>Se încarcă...</p>;
  if (bookings.length === 0) return <p>Nu există programări.</p>;

  return (
    <div style={{ marginTop: 16 }}>
      {bookings.map((booking) => (
        <BookingCard
          key={booking.id}
          booking={booking}
          onCancelled={() => markCancelled(booking.id)}
        />
      ))}
    </div>
  );
}

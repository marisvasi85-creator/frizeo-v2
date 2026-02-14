"use client";

import { useEffect, useState } from "react";
import BookingCard from "./BookingCard";

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


export default function BookingList({
  barberId,
  date,
}: {
  barberId: string;
  date: string;
}) {
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    setLoading(true);

fetch(
  `/api/bookings/list?barberId=${barberId}&date=${date}`
)
  .then((res) => res.json())
  .then((data) => {
    setBookings(Array.isArray(data) ? data : []);
  })
  .finally(() => setLoading(false));
  }, [barberId, date]);

  if (loading) return <p>Se încarcă…</p>;

  if (!loading && bookings.length === 0) {
  return <p>Nicio programare.</p>;
}


  return (
    <div style={{ marginTop: 16 }}>
      {bookings.map((b) => (
  <BookingCard
    key={b.id}
    booking={b}
    onChanged={() => {
      // refetch
      setLoading(true);
      fetch(
        `/api/bookings/list?barberId=${barberId}&date=${date}`
      )
        .then((res) => res.json())
        .then((data) => setBookings(data || []))
        .finally(() => setLoading(false));
    }}
  />
))}

    </div>
  );
}

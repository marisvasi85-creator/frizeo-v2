"use client";

import { useEffect, useState } from "react";
import Calendar from "@/app/booking/[barberId]/components/Calendar";
import SlotPicker from "@/app/booking/[barberId]/components/SlotPicker";
import RescheduleInfo from "./RescheduleInfo";
import RescheduleConfirm from "./RescheduleConfirm";

type Booking = {
  id: string;
  barber_id: string;
  date: string;
  start_time: string;
  end_time: string;
  client_name: string;
};

type Slot = {
  start: string;
  end: string;
};

export default function RescheduleClient({ token }: { token: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1️⃣ Load booking by token
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bookings/by-token?token=${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Programare invalidă");
          return;
        }

        setBooking(data.booking);
        setDate(data.booking.date);
      } catch {
        setError("Eroare server");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  if (loading) return <p>Se încarcă...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!booking) return null;

  return (
    <div className="space-y-6">
      <RescheduleInfo booking={booking} />

      <Calendar
        date={date}
        onChange={(d) => {
          setDate(d);
          setSlot(null);
        }}
      />

      {date && (
        <SlotPicker
          barberId={booking.barber_id}
          date={date}
          excludeBookingId={booking.id}
          selectedSlot={slot}
          onSelect={setSlot}
        />
      )}

      {date && slot && (
        <RescheduleConfirm
          token={token}
          date={date}
          slot={slot}
        />
      )}
    </div>
  );
}

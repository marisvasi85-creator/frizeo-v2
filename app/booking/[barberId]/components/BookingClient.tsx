"use client";

import { useEffect, useState } from "react";
import Calendar from "./Calendar";
import SlotPicker from "./SlotPicker";
import BookingForm from "./BookingForm";

type Props = {
  barberId: string;
};

export default function BookingClient({ barberId }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingDone, setBookingDone] = useState(false);

  useEffect(() => {
    if (!selectedDate) return;

    setSelectedSlot(null);
    setBookingDone(false);

    async function loadSlots() {
      setLoadingSlots(true);
      const res = await fetch(
        `/api/bookings/available?barberId=${barberId}&date=${selectedDate}`
      );
      const data = await res.json();
      setSlots(data);
      setLoadingSlots(false);
    }

    loadSlots();
  }, [selectedDate, barberId]);

  useEffect(() => {
  if (!bookingDone) return;

  // forțează reload sloturi după booking
  async function reloadSlots() {
    const res = await fetch(
      `/api/bookings/available?barberId=${barberId}&date=${selectedDate}`
    );
    const data = await res.json();
    setSlots(data);
  }

  reloadSlots();
}, [bookingDone]);

  return (
    <div style={{ maxWidth: 500 }}>
      <h2>Programează-te</h2>

      <Calendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {selectedDate && (
  <SlotPicker
    barberId={barberId}      // ✅ DA
    date={selectedDate}     // ✅ DA
    slots={slots}
    selectedSlot={selectedSlot}
    onSelectSlot={setSelectedSlot}
    loading={loadingSlots}
  />
)}

      {selectedDate && selectedSlot && !bookingDone && (
        <BookingForm
  barberId={barberId}
  date={selectedDate}
  time={selectedSlot}
  onSuccess={() => {
    setBookingDone(true);
    setSelectedSlot(null);
  }}
/>

      )}

      {bookingDone && (
        <p style={{ marginTop: 16 }}>
          ✅ Programare confirmată. Verifică emailul!
        </p>
      )}
    </div>
  );
}

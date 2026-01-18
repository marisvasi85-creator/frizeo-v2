"use client";

import { useEffect, useState } from "react";
import Calendar from "./Calendar";
import SlotPicker from "./SlotPicker";
import BookingForm from "./BookingForm";

type Props = {
  barberId: string;
};

export default function BookingClient({ barberId }: Props) {
  /* ================= STATE ================= */
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [occupiedSlots, setOccupiedSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* ================= SLOTURI FIXE (TEMPORAR) ================= */
  const ALL_SLOTS = [
    "09:00",
    "10:00",
    "11:00",
    "12:00",
    "13:00",
    "14:00",
    "15:00",
    "16:00",
  ];

  /* ================= FETCH SLOTURI OCUPATE ================= */
  useEffect(() => {
    if (!selectedDate) return;

    setLoading(true);
    setSelectedSlot(null);

    fetch(
      `/api/bookings/occupied?barberId=${barberId}&date=${selectedDate}`
    )
      .then((res) => res.json())
      .then((data: string[]) => {
        setOccupiedSlots(data);
        setSlots(ALL_SLOTS);
      })
      .catch(() => {
        setOccupiedSlots([]);
        setSlots(ALL_SLOTS);
      })
      .finally(() => setLoading(false));
  }, [selectedDate, barberId]);

  /* ================= UI ================= */
  return (
    <div className="space-y-6">
      {/* CALENDAR */}
      <Calendar
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {/* SLOT PICKER */}
      {selectedDate && (
        <SlotPicker
          slots={slots}
          occupiedSlots={occupiedSlots}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          loading={loading}
        />
      )}

      {/* FORMULAR BOOKING */}
      {selectedDate && selectedSlot && (
        <BookingForm
          barberId={barberId}
          date={selectedDate}
          time={selectedSlot}
        />
      )}
    </div>
  );
}

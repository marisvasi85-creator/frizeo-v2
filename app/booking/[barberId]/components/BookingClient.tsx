"use client";

import { useState } from "react";
import Calendar from "./Calendar";
import SlotPicker from "./SlotPicker";
import BookingForm from "./BookingForm";

type Slot = {
  start: string;
  end: string;
};

export default function BookingClient({
  barberId,
}: {
  barberId: string;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* CALENDAR */}
      <Calendar
        date={date}
        onChange={(newDate) => {
          setDate(newDate);
          setSelectedSlot(null);
        }}
      />

      {/* SLOT PICKER */}
      {date && (
        <SlotPicker
  barberId={barberId}
  date={date}
  selectedSlot={selectedSlot}
  onSelect={(slot) => setSelectedSlot(slot)}
/>

      )}

      {/* FORMULAR */}
      {date && selectedSlot && (
        <BookingForm
  barberId={barberId}
  date={date}
  slot={selectedSlot}
  onSuccess={() => setSelectedSlot(null)}
/>

      )}
    </div>
  );
}

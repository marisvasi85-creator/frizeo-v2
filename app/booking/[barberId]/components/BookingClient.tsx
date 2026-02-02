"use client";

import { useState } from "react";
import Calendar from "./Calendar";
import SlotPicker, { Slot } from "./SlotPicker";
import BookingForm from "./BookingForm";

export default function BookingClient({ barberId }: { barberId: string }) {
  const [date, setDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // TEMP – până introducem ServicePicker
  const serviceId = "9b2e3f6a-4d7c-4c2c-9e3a-111111111111";

  return (
    <div className="space-y-6">
      <Calendar
  barberId={barberId}
  date={date}
  onChange={(newDate) => {
    setDate(newDate);
    setSelectedSlot(null);
  }}
/>


      {date && (
        <SlotPicker
          barberId={barberId}
          date={date}
          selectedSlot={selectedSlot}
          onSelect={setSelectedSlot}
        />
      )}

      {date && selectedSlot && (
        <BookingForm
          barberId={barberId}
          serviceId={serviceId}
          date={date}
          slot={selectedSlot}
          onSuccess={() => {
            alert("Programare creată");
            setSelectedSlot(null);
          }}
        />
      )}
    </div>
  );
}

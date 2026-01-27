"use client";

import { useEffect, useState } from "react";
import SlotPicker from "./SlotPicker";
import BookingForm from "./BookingForm";

type Props = {
  barberId: string;
};

export default function BookingClient({ barberId }: Props) {
  const [date, setDate] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!date) return;

    setLoadingSlots(true);
    setSelectedSlot(null);

    fetch(`/api/bookings/available?barberId=${barberId}&date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots || []);
      })
      .catch(() => {
        setSlots([]);
      })
      .finally(() => setLoadingSlots(false));
  }, [date, barberId]);

  return (
    <div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {date && (
        <SlotPicker
          slots={slots}
          selectedSlot={selectedSlot}
          loading={loadingSlots}
          onSelect={setSelectedSlot}
        />
      )}

      {selectedSlot && (
        <BookingForm
          barberId={barberId}
          date={date}
          time={selectedSlot}
          onError={() => setSelectedSlot(null)}
        />
      )}
    </div>
  );
}

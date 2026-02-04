"use client";

import { useEffect, useState } from "react";
import Calendar from "../../../components/Calendar";
import SlotPicker, { Slot } from "../../../components/SlotPicker";
import BookingForm from "./BookingForm";

type Props = {
  barberId: string;
};

export default function BookingClient({ barberId }: Props) {
  const [date, setDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [availableDays, setAvailableDays] = useState<string[]>([]);

  // TEMP până introducem ServicePicker
  const serviceId = "9b2e3f6a-4d7c-4c2c-9e3a-111111111111";

  // 🔒 limite calendar
  const todayISO = new Date().toISOString().slice(0, 10);
  const maxDateISO = new Date(
    new Date().setMonth(new Date().getMonth() + 3)
  )
    .toISOString()
    .slice(0, 10);

  // 📅 fetch zile disponibile (o singură dată)
  useEffect(() => {
    async function loadAvailability() {
      const res = await fetch(
        `/api/availability?barberId=${barberId}&from=${todayISO}&to=${maxDateISO}`
      );
      const data = await res.json();
      setAvailableDays(data.availableDays || []);
    }

    loadAvailability();
  }, [barberId, todayISO, maxDateISO]);

  // reset slot când se schimbă ziua
  useEffect(() => {
    setSelectedSlot(null);
  }, [date]);

  return (
    <div className="space-y-6">
      <Calendar
        value={date}
        onChange={setDate}
        availableDays={availableDays}
        minDate={todayISO}
        maxDate={maxDateISO}
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
            setDate(null);
            setSelectedSlot(null);
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import SlotPicker from "./SlotPicker";
import BookingForm from "./BookingForm";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
};

export default function BookingClient({ barberId }: { barberId: string }) {
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

const [services, setServices] = useState<any[]>([]);
const [serviceId, setServiceId] = useState<string>("");

  const [loadingSlots, setLoadingSlots] = useState(false);

  // 🔹 load services
  useEffect(() => {
  fetch("/api/services")
    .then((res) => res.json())
    .then((data) => {
      setServices(Array.isArray(data) ? data : []);
    })
    .catch(() => setServices([]));
}, []);


  // 🔹 load slots
  useEffect(() => {
    if (!date || !serviceId) return;

    setLoadingSlots(true);
    setSelectedSlot(null);

    fetch(
      `/api/bookings/available?barberId=${barberId}&date=${date}&serviceId=${serviceId}`
    )
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots ?? []);
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [date, barberId, serviceId]);

  return (
    <div>
      {/* SERVICII */}
      <select
  value={serviceId}
  onChange={(e) => setServiceId(e.target.value)}
>
  <option value="">Selectează serviciul</option>

  {services.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name} ({s.duration_minutes} min)
    </option>
  ))}
</select>



      <br />

      {/* DATA */}
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        disabled={!serviceId}
      />

      {/* SLOTURI */}
      {date && (
        <SlotPicker
          slots={slots}
          selectedSlot={selectedSlot}
          loading={loadingSlots}
    onSelect={setSelectedSlot}
  />
)}

      {/* FORMULAR */}
      {selectedSlot && (
        <BookingForm
          barberId={barberId}
          serviceId={serviceId}
          date={date}
          time={selectedSlot}
          onError={() => setSelectedSlot(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import SlotPicker, { Slot } from "@/app/components/SlotPicker";
import BookingForm from "./BookingForm";

type Service = {
  id: string;
  display_name: string;
  duration: number;
};

type Props = {
  barberId: string;
};

export default function BookingClient({ barberId }: Props) {
  const [date, setDate] = useState<string>("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barberServiceId, setBarberServiceId] = useState<string>("");

  /* =========================
     LOAD SERVICES
  ========================= */
  useEffect(() => {
    async function loadServices() {
      const res = await fetch(`/api/services?barberId=${barberId}`);
      const data = await res.json();
      setServices(data.services || []);
    }

    loadServices();
  }, [barberId]);

  return (
    <div className="space-y-6">

      {/* DATE */}
      <div>
        <label>Alege data</label>
        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSlot(null);
          }}
        />
      </div>

      {/* SERVICE SELECT */}
      <div>
        <label>Alege serviciul</label>
        <select
          value={barberServiceId}
          onChange={(e) => {
            setBarberServiceId(e.target.value);
            setSlot(null);
          }}
        >
          <option value="">Selectează serviciu</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.display_name} ({service.duration} min)
            </option>
          ))}
        </select>
      </div>

      {/* SLOT PICKER */}
      {date && barberServiceId && (
        <SlotPicker
          barberId={barberId}
          barberServiceId={barberServiceId}
          date={date}
          selectedSlot={slot}
          onSelect={setSlot}
        />
      )}

      {/* BOOKING FORM */}
      {slot && barberServiceId && (
        <BookingForm
          barberId={barberId}
          barberServiceId={barberServiceId}
          date={date}
          slot={slot}
        />
      )}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import SlotPicker, { Slot } from "@/app/components/SlotPicker";
import BookingForm from "./BookingForm";
import BookingCalendar from "./BookingCalendar";

type Service = {
  id: string;
  display_name: string;
  duration: number;
};

type Props = {
  barberId: string;
};

export default function BookingClient({ barberId }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [slot, setSlot] = useState<Slot | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [barberServiceId, setBarberServiceId] = useState("");
  const [availability, setAvailability] = useState<Record<string, boolean>>(
    {}
  );

  const dateStr = selectedDate
    ? selectedDate.toISOString().slice(0, 10)
    : "";

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

  /* =========================
     LOAD AVAILABILITY (60 zile)
  ========================= */
  useEffect(() => {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);

    const future = new Date();
    future.setDate(today.getDate() + 60);
    const to = future.toISOString().slice(0, 10);

    async function loadAvailability() {
      const res = await fetch(
        `/api/availability?barberId=${barberId}&from=${from}&to=${to}`
      );
      const data = await res.json();
      setAvailability(data.availability || {});
    }

    loadAvailability();
  }, [barberId]);

  return (
    <div className="space-y-6">

      {/* CALENDAR PROFESIONAL */}
      <div>
        <h3 className="font-semibold">Alege data</h3>

        <BookingCalendar
          selected={selectedDate}
          onSelect={(d) => {
            setSelectedDate(d);
            setSlot(null);
          }}
          availability={availability}
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
          disabled={!services.length}
          className="border p-2 w-full"
        >
          <option value="" disabled>
            Selectează serviciu
          </option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.display_name} ({service.duration} min)
            </option>
          ))}
        </select>
      </div>

      {/* SLOT PICKER */}
      {dateStr && barberServiceId && availability[dateStr] !== false && (
        <SlotPicker
          barberId={barberId}
          barberServiceId={barberServiceId}
          date={dateStr}
          selectedSlot={slot}
          onSelect={setSlot}
        />
      )}

      {/* BOOKING FORM */}
      {slot && barberServiceId && (
        <BookingForm
          barberId={barberId}
          barberServiceId={barberServiceId}
          date={dateStr}
          slot={slot}
        />
      )}
    </div>
  );
}
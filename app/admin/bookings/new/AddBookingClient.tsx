"use client";

import { useEffect, useState } from "react";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";
import { Slot } from "@/types/slots";

export default function AddBookingClient({
  barberId,
  services,
}: {
  barberId: string;
  services: any[];
}) {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);

  useEffect(() => {
    async function loadAvailability() {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);

      const next = new Date();
      next.setDate(next.getDate() + 30);
      const to = next.toISOString().slice(0, 10);

      const res = await fetch(
        `/api/availability?barberId=${barberId}&from=${from}&to=${to}`
      );

      const data = await res.json();

      setAvailableDays(data.availableDays || []);
      setWeeklySchedule(data.weeklySchedule || []);
      setOverrides(data.overrides || []);
    }

    loadAvailability();
  }, [barberId]);

  useEffect(() => {
    if (!date || !serviceId) return;

    async function loadSlots() {
      setLoadingSlots(true);

      const res = await fetch(
        `/api/slots?barberId=${barberId}&date=${date}&serviceId=${serviceId}`
      );

      const data = await res.json();

      const freeSlots = (data.slots || []).filter(
        (s: Slot) => s.type === "free"
      );

      setSlots(freeSlots);
      setSlot(null);
      setLoadingSlots(false);
    }

    loadSlots();
  }, [date, serviceId, barberId]);

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">

      <select
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
        className="w-full bg-zinc-800 p-3 rounded text-white"
      >
        <option value="">Alege serviciu</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.display_name}
          </option>
        ))}
      </select>

      <Calendar
        value={date}
        onChange={setDate}
        weeklySchedule={weeklySchedule}
        overrides={overrides}
        availableDays={availableDays}
      />

      {date && serviceId && (
        <SlotPicker
          slots={slots}
          selected={slot}
          onSelect={setSlot}
          loading={loadingSlots}
        />
      )}
    </div>
  );
}
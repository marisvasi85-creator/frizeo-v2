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
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/availability?barberId=${barberId}`)
      .then((r) => r.json())
      .then((d) => setWeeklySchedule(d.weeklySchedule || []));
  }, [barberId]);

  useEffect(() => {
    if (!date) return;

    fetch(
      `/api/slots?barberId=${barberId}&date=${date}&mode=admin`
    )
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [date, barberId]);

  function getMaxDuration(slotTime: string) {
    const [h, m] = slotTime.split(":").map(Number);
    const slotMin = h * 60 + m;

    const schedule = weeklySchedule.find((s) => s.is_working);
    if (!schedule) return 0;

    const workEnd = timeToMinutes(schedule.work_end);

    let limit = workEnd;

    if (schedule.break_enabled) {
      const breakStart = timeToMinutes(schedule.break_start);
      if (slotMin < breakStart) limit = breakStart;
    }

    return limit - slotMin;
  }

  function timeToMinutes(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  return (
    <div className="space-y-6">

      <select
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
        className="w-full bg-zinc-800 p-3 rounded text-white"
      >
        <option value="">Alege serviciu</option>

        {services
          .filter((s) => {
            if (!slot) return true;
            return s.duration <= getMaxDuration(slot);
          })
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name} ({s.duration} min)
            </option>
          ))}
      </select>

      <Calendar value={date} onChange={setDate} />

      {date && (
        <SlotPicker
          slots={slots}
          selected={slot}
          onSelect={setSlot}
        />
      )}
    </div>
  );
}
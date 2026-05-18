"use client";

import { useEffect, useRef, useState } from "react";
import SlotPicker from "@/app/components/SlotPicker";
import Calendar from "@/app/components/Calendar";
import RescheduleInfo from "./RescheduleInfo";

export default function RescheduleClient({ booking, token }: any) {
  const [date, setDate] = useState(booking.date);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);

  const slotsRef = useRef<HTMLDivElement>(null);

  // 🔥 ia durata serviciu
  useEffect(() => {
    fetch(`/api/services?barberId=${booking.barber_id}`)
      .then((r) => r.json())
      .then((services) => {
        const s = services.find((x: any) => x.id === booking.service_id);
        if (s) setDuration(s.duration || 30);
      });
  }, [booking]);

  // 🔥 load sloturi reale
  useEffect(() => {
    if (!date) return;

    fetch(
      `/api/slots?barberId=${booking.barber_id}&date=${date}&serviceId=${booking.service_id}&excludeBookingId=${booking.id}`
    )
      .then((r) => r.json())
      .then((data) => {
        setSlots(data);

        setTimeout(() => {
          slotsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      });
  }, [date, booking]);

  // 🔥 SUBMIT DIRECT (FĂRĂ CONFIRM COMPONENT)
  const handleSubmit = async () => {
    if (!selectedSlot) return;

    const endTime = addMinutes(selectedSlot, duration);

    setLoading(true);

    const res = await fetch("/api/bookings/reschedule", {
      method: "POST",
      body: JSON.stringify({
        token,
        new_date: date,
        new_start_time: selectedSlot,
        new_end_time: endTime,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      setLoading(false);
      return;
    }

    // 🔥 redirect final
    window.location.href = "/reschedule/confirmed";
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">

      {/* HEADER */}
      <div>
        <h2 className="text-2xl font-semibold">
          Reprogramează programarea
        </h2>
        <p className="text-sm text-gray-500">
          Selectează o nouă dată și oră
        </p>
      </div>

      {/* GRID */}
      <div className="grid md:grid-cols-2 gap-10">

        {/* STÂNGA */}
        <div className="space-y-6">

          {/* INFO */}
          <RescheduleInfo booking={booking} />

          {/* CALENDAR */}
          <div className="border rounded-2xl p-4 shadow-sm">
            <Calendar
              value={date}
              onChange={(d: string) => {
                setDate(d);
                setSelectedSlot(null);
              }}
            />
          </div>

        </div>

        {/* DREAPTA */}
        <div
          ref={slotsRef}
          className="border rounded-2xl p-4 shadow-sm flex flex-col justify-between"
        >

          <div>
            <p className="font-medium mb-4">Alege ora</p>

            {slots.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Nu există sloturi disponibile
              </p>
            ) : (
              <SlotPicker
                slots={slots}
                selected={selectedSlot}
                onSelect={setSelectedSlot}
              />
            )}
          </div>

          {/* 🔥 BUTTON FINAL */}
          <button
            onClick={handleSubmit}
            disabled={!selectedSlot || loading}
            className={`
              mt-6 w-full p-4 rounded-xl font-medium transition
              ${
                !selectedSlot
                  ? "bg-gray-300 text-gray-500"
                  : "bg-black text-white hover:opacity-90"
              }
            `}
          >
            {loading ? "Se procesează..." : "Confirmă reprogramarea"}
          </button>

        </div>

      </div>
    </div>
  );
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h);
  d.setMinutes(m + minutes);
  return d.toTimeString().slice(0, 5);
}
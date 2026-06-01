"use client";

import { useEffect, useState } from "react";
import Calendar from "@/app/components/Calendar"; // 🔥 același ca public
import SlotPicker from "@/app/components/SlotPicker";

export default function NewBookingPage() {
  const [date, setDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);

  // 🔥 LOAD AVAILABILITY + SETTINGS
  useEffect(() => {
    async function load() {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);

      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      const to = next.toISOString().slice(0, 10);

      const res = await fetch(`/api/availability?from=${from}&to=${to}`);
      const data = await res.json();

      setAvailableDays(data.availableDays || []);

      // 🔥 weekly + overrides (pentru disabled)
      const w = await fetch("/api/barber-weekly-schedule");
      const wData = await w.json();
      setWeeklySchedule(wData || []);

      const o = await fetch("/api/barber-overrides");
      const oData = await o.json();
      setOverrides(oData || []);
    }

    load();
  }, []);

  // 🔥 LOAD SLOTS
  useEffect(() => {
    if (!date) return;

    async function loadSlots() {
      const res = await fetch(`/api/slots?date=${date}`);
      const data = await res.json();

      setSlots(data.slots || []);
    }

    loadSlots();
  }, [date]);

  return (
    <div className="max-w-xl space-y-6">

      <h1 className="text-2xl font-semibold">
        Adaugă programare
      </h1>

      {/* 🔥 CALENDAR REAL */}
      <Calendar
        value={date}
        onChange={setDate}
        weeklySchedule={weeklySchedule}
        overrides={overrides}
        availableDays={availableDays}
      />

      {/* 🔥 SLOTURI */}
      {date && (
        <SlotPicker
          slots={slots}
          selected={selectedSlot}
          onSelect={setSelectedSlot}
        />
      )}

      {/* DEBUG */}
      {selectedSlot && (
        <div className="text-green-400">
          Selectat: {date} {selectedSlot}
        </div>
      )}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";
import EditBookingModal from "./components/EditBookingModal";
import { Slot } from "@/types/slots";

function toISO(date: Date) {
  return date.toISOString().split("T")[0];
}

export default function AdminBookingsPage() {
  const today = toISO(new Date());

  const [barberId, setBarberId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);

  const [bookings, setBookings] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);

  const [slots, setSlots] = useState<Slot[]>([]);

  const [editing, setEditing] = useState<any | null>(null);
  const [creatingSlot, setCreatingSlot] = useState<string | null>(null);

  const [newBooking, setNewBooking] = useState({
    service_id: "",
    client_name: "",
    client_phone: "",
    client_email: "",
  });

  // =========================
  // VALIDARE SERVICIU
  // =========================
  const isServiceValid = (slot: string, duration: number) => {
    if (!slot || !selectedDate) return true;

    const [h, m] = slot.split(":").map(Number);
    const start = h * 60 + m;
    const end = start + duration;

    const d = new Date(selectedDate);
    const jsDay = d.getDay();
    const day = jsDay === 0 ? 7 : jsDay;

    const schedule = weeklySchedule.find(
      (s: any) => s.day_of_week === day
    );

    if (!schedule || !schedule.work_end) return true;

    // program
    const [eh, em] = schedule.work_end.split(":").map(Number);
    const workEnd = eh * 60 + em;

    if (end > workEnd) return false;

    // pauza
    if (schedule.break_enabled && schedule.break_start && schedule.break_end) {
      const [bh, bm] = schedule.break_start.split(":").map(Number);
      const [beh, bem] = schedule.break_end.split(":").map(Number);

      const breakStart = bh * 60 + bm;
      const breakEnd = beh * 60 + bem;

      if (start < breakEnd && end > breakStart) return false;
    }

    // booking-uri
    const overlaps = bookings.some((b) => {
      if (b.date !== selectedDate) return false;

      const [sh, sm] = b.start_time.split(":").map(Number);
      const [eh2, em2] = b.end_time.split(":").map(Number);

      const bStart = sh * 60 + sm;
      const bEnd = eh2 * 60 + em2;

      return start < bEnd && end > bStart;
    });

    if (overlaps) return false;

    return true;
  };

  // =========================
  // LOAD
  // =========================
  async function loadBarber() {
    const res = await fetch("/api/barber/me");
    const data = await res.json();
    setBarberId(data?.profile?.id || null);
  }

  async function loadBookings() {
    const res = await fetch("/api/bookings/list");
    const data = await res.json();
    setBookings(data.bookings || []);
  }

  async function loadServices(id: string) {
    const res = await fetch(`/api/services?barberId=${id}`);
    const data = await res.json();
    setServices(data.services || []);
  }

  async function loadAvailability(id: string) {
    const next = new Date();
    next.setDate(next.getDate() + 30);

    const res = await fetch(
      `/api/availability?barberId=${id}&from=${today}&to=${toISO(next)}`
    );

    const data = await res.json();

    setAvailableDays(data.availableDays || []);
    setWeeklySchedule(data.weeklySchedule || []);
    setOverrides(data.overrides || []);
  }

  async function loadSlots(id: string, date: string) {
    const res = await fetch(
      `/api/slots?barberId=${id}&date=${date}&mode=admin`
    );
    const data = await res.json();
    setSlots(data.slots || []);
  }

  useEffect(() => {
    loadBarber();
  }, []);

  useEffect(() => {
    if (!barberId) return;

    loadBookings();
    loadServices(barberId);
    loadAvailability(barberId);
  }, [barberId]);

  useEffect(() => {
    if (!barberId) return;
    loadSlots(barberId, selectedDate);
  }, [selectedDate, barberId]);

  // =========================
  // CREATE BOOKING
  // =========================
  async function createBooking() {
    if (!creatingSlot || !barberId) return;

    const service = services.find((s) => s.id === newBooking.service_id);
    if (!service) return alert("Alege serviciu");

    const duration = service.duration;

    const [h, m] = creatingSlot.split(":").map(Number);

    const start = new Date();
    start.setHours(h);
    start.setMinutes(m);

    const end = new Date(start);
    end.setMinutes(start.getMinutes() + duration);

    const endTime = end.toTimeString().slice(0, 5);

    const hold = await fetch("/api/bookings/hold", {
      method: "POST",
      body: JSON.stringify({
        barber_id: barberId,
        barber_service_id: newBooking.service_id,
        date: selectedDate,
        start_time: creatingSlot,
        end_time: endTime,
      }),
    });

    const holdData = await hold.json();

    await fetch("/api/bookings/create", {
      method: "POST",
      body: JSON.stringify({
        bookingId: holdData.holdId,
        client_name: newBooking.client_name,
        client_phone: newBooking.client_phone,
        client_email: newBooking.client_email,
      }),
    });

    setCreatingSlot(null);
    loadBookings();
    loadSlots(barberId, selectedDate);
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="p-6 text-white space-y-6">

      <h1 className="text-2xl font-semibold">Programări</h1>

      <div className="grid md:grid-cols-[320px_1fr] gap-6">

        <Calendar
          value={selectedDate}
          onChange={setSelectedDate}
          weeklySchedule={weeklySchedule}
          overrides={overrides}
          availableDays={availableDays}
        />

        <div className="space-y-6">

          <SlotPicker
            slots={slots}
            selected={creatingSlot}
            onSelect={(slot) => setCreatingSlot(slot)}
            onBookingClick={(b) => setEditing(b)}
          />

        </div>
      </div>

      {/* CREATE MODAL */}
      {creatingSlot && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

    <div className="bg-zinc-900 p-6 rounded-2xl w-full max-w-md space-y-4 shadow-xl">

      <h2 className="text-lg font-semibold text-white">
        Creează programare
      </h2>

      {/* SERVICE */}
      <select
        value={newBooking.service_id}
        onChange={(e) =>
          setNewBooking({ ...newBooking, service_id: e.target.value })
        }
        className="w-full p-3 rounded-xl bg-zinc-800 text-white border border-zinc-700"
      >
        <option value="">Alege serviciu</option>

        {services.map((s) => {
          const disabled = !isServiceValid(creatingSlot, s.duration);

          return (
            <option key={s.id} value={s.id} disabled={disabled}>
              {s.display_name} ({s.duration} min)
              {disabled ? " - nu încape" : ""}
            </option>
          );
        })}
      </select>

      {/* NUME + TELEFON */}
      <div className="grid grid-cols-2 gap-3">
        <input
          placeholder="Nume"
          value={newBooking.client_name}
          onChange={(e) =>
            setNewBooking({ ...newBooking, client_name: e.target.value })
          }
          className="p-3 rounded-xl bg-zinc-800 text-white border border-zinc-700 placeholder:text-zinc-400"
        />

        <input
          placeholder="Telefon"
          value={newBooking.client_phone}
          onChange={(e) =>
            setNewBooking({ ...newBooking, client_phone: e.target.value })
          }
          className="p-3 rounded-xl bg-zinc-800 text-white border border-zinc-700 placeholder:text-zinc-400"
        />
      </div>

      {/* EMAIL */}
      <input
        placeholder="Email (optional)"
        value={newBooking.client_email}
        onChange={(e) =>
          setNewBooking({ ...newBooking, client_email: e.target.value })
        }
        className="w-full p-3 rounded-xl bg-zinc-800 text-white border border-zinc-700 placeholder:text-zinc-400"
      />

      {/* BUTTONS */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={createBooking}
          className="flex-1 bg-white text-black p-3 rounded-xl font-medium hover:opacity-90"
        >
          Creează
        </button>

        <button
          onClick={() => setCreatingSlot(null)}
          className="flex-1 bg-zinc-700 text-white p-3 rounded-xl hover:bg-zinc-600"
        >
          Închide
        </button>
      </div>

    </div>
  </div>
)}

      {/* EDIT */}
      {editing && (
        <EditBookingModal
          booking={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadBookings();
          }}
        />
      )}
    </div>
  );
}
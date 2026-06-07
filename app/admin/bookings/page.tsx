"use client";

import { useEffect, useState } from "react";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";
import EditBookingModal from "./components/EditBookingModal";

type Slot = {
  time: string;
  occupied: boolean;
  booking?: any;
};

function toISO(date: Date) {
  return date.toISOString().split("T")[0];
}

export default function AdminBookingsPage() {
  const today = toISO(new Date());

  const [barberId, setBarberId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(today);
  const [bookings, setBookings] = useState<any[]>([]);

  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);

  const [slots, setSlots] = useState<Slot[]>([]);

  const [editing, setEditing] = useState<any | null>(null);
  const [creatingSlot, setCreatingSlot] = useState<string | null>(null);

  // FORM
  const [serviceId, setServiceId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [services, setServices] = useState<any[]>([]);

  // =========================
  // 🔥 BARBER
  // =========================
  async function loadBarber() {
    const res = await fetch("/api/barber/me");
    const data = await res.json();

    console.log("🔥 BARBER:", data);

    setBarberId(data?.profile?.id || null);
  }

  // =========================
  // 🔥 BOOKINGS
  // =========================
  async function loadBookings() {
    const res = await fetch("/api/bookings/list");
    const data = await res.json();

    console.log("🔥 BOOKINGS RAW:", data);

    const list = Array.isArray(data.bookings) ? data.bookings : [];

    console.log("🔥 BOOKINGS ARRAY:", list);

    setBookings(list);
  }

  // =========================
  // 🔥 SERVICES
  // =========================
  async function loadServices(id: string) {
    const res = await fetch(`/api/services?barberId=${id}`);
    const data = await res.json();

    console.log("🔥 SERVICES:", data);

    setServices(data.services || []);
  }

  // =========================
  // 🔥 AVAILABILITY
  // =========================
  async function loadAvailability(id: string) {
    const from = today;

    const next = new Date();
    next.setDate(next.getDate() + 30);
    const to = toISO(next);

    const res = await fetch(
      `/api/availability?barberId=${id}&from=${from}&to=${to}`
    );

    const data = await res.json();

    console.log("🔥 AVAILABILITY:", data);

    setAvailableDays(data.availableDays || []);
    setWeeklySchedule(data.weeklySchedule || []);
    setOverrides(data.overrides || []);
  }

  // =========================
  // 🔥 SLOTS
  // =========================
  async function loadSlots(id: string, date: string) {
    console.log("🔥 LOAD SLOTS CALL:", { id, date });

    const res = await fetch(
      `/api/slots?barberId=${id}&date=${date}`
    );

    const data = await res.json();

    console.log("🔥 SLOTS:", data);

    setSlots(data.slots || []);
  }

  // =========================
  // 🔥 INIT
  // =========================
  useEffect(() => {
    loadBarber();
  }, []);

  useEffect(() => {
    console.log("🔥 barberId:", barberId);

    if (!barberId) return;

    loadBookings();
    loadAvailability(barberId);
    loadServices(barberId);
  }, [barberId]);

  useEffect(() => {
    if (!barberId || !selectedDate) return;

    loadSlots(barberId, selectedDate);
  }, [selectedDate, barberId]);

  // =========================
  // 🔥 SORT BOOKINGS (TOATE)
  // =========================
  const sortedBookings = bookings
    .filter((b) => b.status !== "cancelled")
    .sort((a, b) => {
      const aDate = new Date(`${a.date}T${a.start_time}`);
      const bDate = new Date(`${b.date}T${b.start_time}`);
      return bDate.getTime() - aDate.getTime();
    });

  console.log("🔥 SORTED BOOKINGS:", sortedBookings);

  // =========================
  // 🔥 CREATE BOOKING
  // =========================
  async function handleCreateBooking() {
    if (!creatingSlot || !barberId || !serviceId || !name || !phone) {
      alert("Completează toate câmpurile");
      return;
    }

    const service = services.find((s) => s.id === serviceId);
    const duration = service?.duration || 30;

    const [h, m] = creatingSlot.split(":").map(Number);

    const d = new Date(selectedDate);
    d.setHours(h);
    d.setMinutes(m + duration);

    const endTime = d.toTimeString().slice(0, 5);

    const hold = await fetch("/api/bookings/hold", {
      method: "POST",
      body: JSON.stringify({
        barber_id: barberId,
        barber_service_id: serviceId,
        date: selectedDate,
        start_time: creatingSlot,
        end_time: endTime,
      }),
    });

    const holdData = await hold.json();

    const create = await fetch("/api/bookings/create", {
      method: "POST",
      body: JSON.stringify({
        bookingId: holdData.holdId,
        client_name: name,
        client_phone: phone,
        client_email: email || null,
      }),
    });

    const data = await create.json();

    if (!create.ok) {
      alert(data.error);
      return;
    }

    setCreatingSlot(null);
    setName("");
    setPhone("");
    setEmail("");
    setServiceId("");

    loadBookings();
    loadSlots(barberId, selectedDate);
  }

  return (
    <div className="p-6 text-white space-y-6">

      <h1 className="text-2xl font-semibold">
        Programări
      </h1>

      <div className="grid md:grid-cols-[320px_1fr] gap-6">

        {/* CALENDAR */}
        <div className="bg-[#0F0F10] p-4 rounded-xl">
          <Calendar
            value={selectedDate}
            onChange={setSelectedDate}
            weeklySchedule={weeklySchedule}
            overrides={overrides}
            availableDays={availableDays}
          />
        </div>

        {/* RIGHT */}
        <div className="space-y-6">

          <h2 className="text-lg font-semibold capitalize">
            {new Date(selectedDate).toLocaleDateString("ro-RO", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h2>

          {/* SLOTURI */}
          <SlotPicker
            slots={slots}
            selected={null}
            onSelect={(slot) => setCreatingSlot(slot)}
            onBookingClick={(b) => setEditing(b)}
          />

          {/* 🔥 LISTA PROGRAMARI */}
          <div className="space-y-3">
            <h3 className="text-sm text-white/60">
              Toate programările
            </h3>

            {sortedBookings.length === 0 && (
              <div className="text-white/40 text-sm">
                Nu există programări.
              </div>
            )}

            {sortedBookings.map((b) => (
              <div
                key={b.id}
                className="bg-zinc-900 p-4 rounded-xl flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold">
                    {b.start_time.slice(0, 5)} - {b.end_time.slice(0, 5)}
                  </div>

                  <div className="text-sm">
                    {b.client_name}
                  </div>

                  <div className="text-xs text-blue-400">
                    {b.barber_services?.display_name || "—"}
                  </div>

                  <div className="text-xs text-gray-400">
                    {b.client_phone}
                  </div>

                  <div className="text-xs text-gray-500">
                    {b.client_email}
                  </div>
                </div>

                <button
                  onClick={() => setEditing(b)}
                  className="px-3 py-1 bg-white text-black rounded text-sm"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>

        </div>
      </div>

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

      {/* CREATE */}
      {creatingSlot && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-zinc-900 p-6 rounded-xl w-full max-w-md space-y-4">

            <h2 className="text-white text-lg font-semibold">
              Creează programare
            </h2>

            <div className="text-sm text-gray-400">
              {selectedDate} - {creatingSlot}
            </div>

            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full bg-zinc-800 p-3 rounded text-white"
            >
              <option value="">Alege serviciu</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name} ({s.duration} min)
                </option>
              ))}
            </select>

            <input
              placeholder="Nume"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-800 p-3 rounded text-white"
            />

            <input
              placeholder="Telefon"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-zinc-800 p-3 rounded text-white"
            />

            <input
              placeholder="Email (opțional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-zinc-800 p-3 rounded text-white"
            />

            <button
              onClick={handleCreateBooking}
              className="w-full bg-white text-black py-3 rounded"
            >
              Creează
            </button>

            <button
              onClick={() => setCreatingSlot(null)}
              className="w-full bg-zinc-700 text-white py-2 rounded"
            >
              Anulează
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
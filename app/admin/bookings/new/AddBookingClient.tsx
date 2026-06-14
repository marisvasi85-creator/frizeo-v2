"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";
import { Slot } from "@/types/slots";

export default function AddBookingClient({
  barberId,
  initialServices,
  role,
  barbers,
}: {
  barberId: string;
  initialServices: any[];
  role: string | null;
  barbers: any[];
}) {
  const router = useRouter();

  const [date, setDate] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string>("");
  const [services, setServices] =
  useState(initialServices);
  const [selectedBarberId, setSelectedBarberId] =
  useState(barberId);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const slotsCache = useRef<Record<string, Slot[]>>({});

  useEffect(() => {
    async function loadAvailability() {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);

      const future = new Date();
      future.setDate(future.getDate() + 30);

      const to = future.toISOString().slice(0, 10);

      const res = await fetch(
  `/api/availability?barberId=${selectedBarberId}&from=${from}&to=${to}`
);
      const data = await res.json();

      setAvailableDays(data.availableDays || []);
      setWeeklySchedule(data.weeklySchedule || []);
      setOverrides(data.overrides || []);
    }

    loadAvailability();
}, [selectedBarberId]);

useEffect(() => {
  async function loadServices() {
    const res = await fetch(
      `/api/services?barberId=${selectedBarberId}`
    );

    const data = await res.json();

    setServices(data.services || []);

    setServiceId("");
    setDate(null);
    setSlots([]);
    setSelectedSlot(null);
  }

  if (role === "owner") {
    loadServices();
  }
}, [selectedBarberId, role]);

  useEffect(() => {
    if (!date || !serviceId) return;

    const cacheKey = `${date}_${serviceId}`;

    if (slotsCache.current[cacheKey]) {
      setSlots(slotsCache.current[cacheKey]);
      return;
    }

    async function loadSlots() {
      setLoadingSlots(true);

      const res = await fetch(
  `/api/slots?barberId=${selectedBarberId}&date=${date}&serviceId=${serviceId}`
);

const data = await res.json();

const freeSlots: Slot[] = (
  data.slots || []
).filter(
  (s: Slot) => s.type === "free"
);

slotsCache.current[cacheKey] =
  freeSlots;

setSlots(freeSlots);
setSelectedSlot(null);

setLoadingSlots(false);
    }

    loadSlots();
 }, [date, serviceId, selectedBarberId]);
  async function createBooking() {
    if (!selectedSlot || !date || !serviceId) return;

    if (!name.trim()) {
      alert("Introdu numele clientului");
      return;
    }

    if (!phone.trim()) {
      alert("Introdu telefonul");
      return;
    }

    try {
      setSaving(true);

      const service = services.find(
        (s) => s.id === serviceId
      );

      const duration = service?.duration || 30;

      const [y, m, d] = date.split("-").map(Number);
      const [h, min] = selectedSlot.split(":").map(Number);

      const endDate = new Date(y, m - 1, d);
      endDate.setHours(h);
      endDate.setMinutes(min + duration);

      const endTime = endDate
        .toTimeString()
        .slice(0, 5);

      const holdRes = await fetch(
        "/api/bookings/hold",
        {
          method: "POST",
          body: JSON.stringify({
  barber_id: selectedBarberId,
  barber_service_id: serviceId,
            date,
            start_time: selectedSlot,
            end_time: endTime,
          }),
        }
      );

      const holdData = await holdRes.json();

      if (!holdRes.ok) {
        throw new Error(
          holdData.error || "Slot ocupat"
        );
      }

      const createRes = await fetch(
        "/api/bookings/create",
        {
          method: "POST",
          body: JSON.stringify({
            bookingId: holdData.holdId,
            client_name: name,
            client_phone: phone,
            client_email: email || null,
          }),
        }
      );

      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(
          createData.error || "Eroare creare"
        );
      }

      router.push("/admin/bookings");

    } catch (err: any) {
      alert(err.message || "Eroare");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
{role === "owner" && (
  <select
    value={selectedBarberId}
    onChange={(e) =>
      setSelectedBarberId(
        e.target.value
      )
    }
    className="w-full bg-zinc-800 p-3 rounded text-white"
  >
    {barbers.map((barber) => (
      <option
        key={barber.id}
        value={barber.id}
      >
        {barber.display_name}
      </option>
    ))}
  </select>
)}
      <select
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
        className="w-full bg-zinc-800 p-3 rounded text-white"
      >
        <option value="">
          Alege serviciu
        </option>

        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.display_name} ({s.duration} min)
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

      {(loadingSlots || slots.length > 0) &&
        date &&
        serviceId && (
          <SlotPicker
            slots={slots}
            selected={selectedSlot}
            onSelect={setSelectedSlot}
            loading={loadingSlots}
          />
        )}

      {selectedSlot && (
        <div className="space-y-3 border border-zinc-800 rounded-xl p-4">

          <input
            placeholder="Nume client"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            className="w-full p-3 rounded-xl bg-zinc-800 text-white"
          />

          <input
            placeholder="Telefon"
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value)
            }
            className="w-full p-3 rounded-xl bg-zinc-800 text-white"
          />

          <input
            placeholder="Email (opțional)"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="w-full p-3 rounded-xl bg-zinc-800 text-white"
          />

          <button
            onClick={createBooking}
            disabled={saving}
            className="w-full bg-white text-black p-3 rounded-xl font-medium"
          >
            {saving
              ? "Se creează..."
              : "Creează programare"}
          </button>
        </div>
      )}

    </div>
  );
}
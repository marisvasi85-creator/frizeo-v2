"use client";

import { useEffect, useState } from "react";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";

export default function BookingClient({
  barberId,
}: {
  barberId: string;
}) {
  const [mounted, setMounted] = useState(false);

  const [date, setDate] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);

  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  // 🔥 LOAD SERVICES
  useEffect(() => {
    const load = async () => {
      const res = await fetch(`/api/services?barberId=${barberId}`);
      const data = await res.json();
      setServices(data || []);
    };
    load();
  }, [barberId]);

  // 🔥 LOAD SLOTS
  useEffect(() => {
    if (!date || !serviceId) return;

    const load = async () => {
      const res = await fetch(
        `/api/slots?barberId=${barberId}&date=${date}&serviceId=${serviceId}`
      );
      const data = await res.json();

      setSlots(data || []);
      setSelectedSlot(null);
    };

    load();
  }, [date, serviceId, barberId]);

  if (!mounted) return null;

  // 🔥 CREATE BOOKING FINAL
  const createBooking = async () => {
    if (!selectedSlot || !date || !serviceId) return;

    const service = services.find((s) => s.id === serviceId);
    const duration = service?.duration || 30;

    const [h, m] = selectedSlot.split(":").map(Number);
    const d = new Date();
    d.setHours(h);
    d.setMinutes(m + duration);

    const endTime = d.toTimeString().slice(0, 5);

    setLoading(true);
    setError(null);

    // 🔥 HOLD
    const holdRes = await fetch("/api/bookings/hold", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        barber_id: barberId,
        date,
        start_time: selectedSlot,
        end_time: endTime,
      }),
    });

    const holdData = await holdRes.json();

    if (!holdRes.ok) {
      setError(holdData.error);
      setLoading(false);
      return;
    }

    // 🔥 CONFIRM
    const createRes = await fetch("/api/bookings/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId: holdData.holdId,
        client_name: name,
        client_phone: phone,
        client_email: email || null,
      }),
    });

    const createData = await createRes.json();

    if (!createRes.ok) {
      setError(createData.error);
      setLoading(false);
      return;
    }

    // 🔥 REFRESH SLOTURI
    const res = await fetch(
      `/api/slots?barberId=${barberId}&date=${date}&serviceId=${serviceId}`
    );
    const newSlots = await res.json();

    setSlots(newSlots);
    setSelectedSlot(null);

    setLoading(false);

    window.location.href = `/booking/confirmed/${createData.bookingId}`;
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl text-center font-semibold">
        Programează-te
      </h1>

      {/* DATA */}
      <Calendar value={date} onChange={setDate} />

      {/* SERVICIU */}
      {date && (
        <select
          className="w-full border p-3 rounded"
          value={serviceId || ""}
          onChange={(e) => setServiceId(e.target.value)}
        >
          <option value="">Alege serviciu</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name || s.name}
            </option>
          ))}
        </select>
      )}

      {/* SLOTURI */}
      {serviceId && slots.length > 0 && (
        <SlotPicker
          slots={slots}
          selected={selectedSlot}
          onSelect={setSelectedSlot}
        />
      )}

      {/* DATE CLIENT */}
      {selectedSlot && (
        <div className="space-y-3">
          <input
            placeholder="Nume"
            className="w-full border p-3 rounded"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Telefon"
            className="w-full border p-3 rounded"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            placeholder="Email (opțional)"
            className="w-full border p-3 rounded"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button
            onClick={createBooking}
            className="w-full bg-black text-white p-3 rounded"
            disabled={loading}
          >
            {loading ? "Se procesează..." : "Programează-te"}
          </button>
        </div>
      )}

      {error && <div className="text-red-500">{error}</div>}
    </div>
  );
}
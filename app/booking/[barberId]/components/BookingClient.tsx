"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";

export default function BookingClient({ barberId }: { barberId: string }) {
  const router = useRouter();

  const [date, setDate] = useState<Date | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);

  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =========================
  // 🔥 LOAD SERVICES
  // =========================
  useEffect(() => {
  const loadServices = async () => {
    try {
      const res = await fetch(`/api/services?barberId=${barberId}`);
      const data = await res.json();

      console.log("SERVICES RAW:", data);

      // 🔥 EXACT ca la modal
      setServices(Array.isArray(data?.services) ? data.services : []);
    } catch (err) {
      console.error("SERVICES ERROR:", err);
      setServices([]);
    }
  };

  loadServices();
}, [barberId]);

  // =========================
  // 🔥 FORMAT DATE SAFE
  // =========================
  const formattedDate = (() => {
    if (!date) return null;

    const d = new Date(date);
    if (isNaN(d.getTime())) return null;

    return d.toISOString().split("T")[0];
  })();

  // =========================
  // 🔥 LOAD SLOTS
useEffect(() => {
  if (!formattedDate || !serviceId) return;

  const loadSlots = async () => {
    try {
      const res = await fetch(
        `/api/slots?barberId=${barberId}&date=${formattedDate}&serviceId=${serviceId}`
      );

      const data = await res.json();

      console.log("SLOTS RAW:", data);

      setSlots(Array.isArray(data?.slots) ? data.slots : []);
      setSelectedSlot(null);
    } catch {
      setSlots([]);
    }
  };

  loadSlots();
}, [formattedDate, serviceId, barberId]);

  // =========================
  // 🔥 RESET când schimbi data
  // =========================
  useEffect(() => {
    setServiceId(null);
    setSlots([]);
    setSelectedSlot(null);
  }, [formattedDate]);

  // =========================
  // 🔥 CREATE BOOKING FLOW
  // =========================
  const createBooking = async () => {
    if (!selectedSlot || !formattedDate || !serviceId) {
      setError("Selectează toate datele");
      return;
    }

    if (!name || !phone) {
      setError("Completează nume și telefon");
      return;
    }

    const service = services.find((s) => s.id === serviceId);
    const duration = service?.duration || 30;

    // 🔥 calcul end time
    const [h, m] = selectedSlot.split(":").map(Number);
    const d = new Date();
    d.setHours(h);
    d.setMinutes(m + duration);

    const endTime = d.toTimeString().slice(0, 5);

    setLoading(true);
    setError(null);

    try {
      // =========================
      // 🔥 HOLD
      // =========================
      const holdRes = await fetch("/api/bookings/hold", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barber_id: barberId,
          barber_service_id: serviceId,
          date: formattedDate,
          start_time: selectedSlot,
          end_time: endTime,
        }),
      });

      const holdData = await holdRes.json();

      if (!holdRes.ok) {
        throw new Error(holdData.error || "Slot ocupat");
      }

      // =========================
      // 🔥 CONFIRM
      // =========================
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
        throw new Error(createData.error || "Eroare creare");
      }

      // 🔥 redirect final
      router.push(`/booking/confirmed/${createData.bookingId}`);

    } catch (err: any) {
      setError(err.message || "Eroare necunoscută");
      setLoading(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl text-center font-semibold">
        Programează-te
      </h1>

      {/* CALENDAR */}
      <Calendar value={date} onChange={setDate} />

      {/* SERVICIU */}
      {date && (
        <select
          className="w-full border p-3 rounded"
          value={serviceId || ""}
          onChange={(e) => setServiceId(e.target.value)}
        >
          <option value="">Alege serviciu</option>

          {Array.isArray(services) &&
            services.map((s) => (
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

      {/* FORM CLIENT */}
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
            disabled={loading}
            className="w-full bg-black text-white p-3 rounded"
          >
            {loading ? "Se procesează..." : "Programează-te"}
          </button>
        </div>
      )}

      {error && (
        <div className="text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
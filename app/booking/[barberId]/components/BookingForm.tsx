"use client";

import { useState, useEffect } from "react";
import SlotPicker, { Slot } from "@/app/components/SlotPicker";

export default function BookingForm({ barberId }: { barberId: string }) {
  const [date, setDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [services, setServices] = useState<any[]>([]);
  const [serviceId, setServiceId] = useState("");

  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  const [loading, setLoading] = useState(false);

  // 🔥 LOAD SERVICES
  useEffect(() => {
    const loadServices = async () => {
      const res = await fetch(`/api/services?barberId=${barberId}`);
      const data = await res.json();
      setServices(Array.isArray(data) ? data : []);
    };

    loadServices();
  }, [barberId]);

  // 🔥 CONFIRM DIRECT (fără HOLD)
  const handleSubmit = async () => {
    if (!date || !selectedSlot) {
      alert("Selectează data și ora");
      return;
    }

    if (!clientName || !clientPhone) {
      alert("Completează nume și telefon");
      return;
    }

    if (!serviceId) {
      alert("Selectează serviciul");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/bookings/create-direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barberId,
          serviceId,
          date,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          client_name: clientName,
          client_phone: clientPhone,
          client_email: clientEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Eroare booking");
        return;
      }

      window.location.href = `/booking/confirmed/${data.bookingId}`;
    } catch {
      alert("Eroare server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. DATA */}
      <input
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setSelectedSlot(null);
        }}
        className="border p-2 rounded w-full"
      />

      {/* 2. SLOT */}
      {date && (
        <SlotPicker
          barberId={barberId}
          barberServiceId={"dummy"} // nu mai contează
          date={date}
          selectedSlot={selectedSlot}
          onSelect={setSelectedSlot}
        />
      )}

      {/* 3. CLIENT */}
      <input
        type="text"
        placeholder="Nume"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        className="border p-2 rounded w-full"
      />

      <input
        type="text"
        placeholder="Telefon"
        value={clientPhone}
        onChange={(e) => setClientPhone(e.target.value)}
        className="border p-2 rounded w-full"
      />

      <input
        type="email"
        placeholder="Email (optional)"
        value={clientEmail}
        onChange={(e) => setClientEmail(e.target.value)}
        className="border p-2 rounded w-full"
      />

      {/* 4. SERVICIU */}
      <div className="grid grid-cols-2 gap-2">
  {services.map((s) => {
    const active = serviceId === s.id;

    return (
      <button
        key={s.id}
        onClick={() => setServiceId(s.id)}
        className={`
          border rounded-lg p-3 text-left transition
          ${active
            ? "bg-black text-white border-black"
            : "bg-white hover:bg-gray-100"}
        `}
      >
        <div className="font-medium">
          {s.name}
        </div>

        <div className="text-sm opacity-70">
          {s.duration} min
        </div>
      </button>
    );
  })}
</div>

      {/* 5. CONFIRM */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="bg-black text-white px-4 py-2 rounded w-full"
      >
        {loading ? "Se procesează..." : "Programează-te"}
      </button>
    </div>
  );
}
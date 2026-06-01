"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";

export default function BookingClient({
  barberId,
  barberName,
}: {
  barberId: string;
  barberName: string;
}) {
  const router = useRouter();

  const [date, setDate] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string | null>(null);

  const [services, setServices] = useState<any[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);

  const [availableDays, setAvailableDays] = useState<string[]>([]);

  const [loadingSlots, setLoadingSlots] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [error, setError] = useState<string | null>(null);

  // 🔥 CACHE SLOTURI (NU AM MODIFICAT LOGICA TA)
  const slotsCache = useRef<Record<string, string[]>>({});

  // =========================
  // 🔥 LOAD SERVICES
  // =========================
  useEffect(() => {
    fetch(`/api/services?barberId=${barberId}`)
      .then((r) => r.json())
      .then((d) => setServices(d.services || []));
  }, [barberId]);

  // =========================
  // 🔥 LOAD SCHEDULE + OVERRIDES (FIX AICI)
  // =========================
  useEffect(() => {
    const load = async () => {
      const [sRes, oRes] = await Promise.all([
        fetch(`/api/barber-weekly-schedule?barberId=${barberId}`),
        fetch(`/api/barber-overrides?barberId=${barberId}`),
      ]);

      const sData = await sRes.json();
      const oData = await oRes.json();

      // 🔥 FIX CRITIC
      setWeeklySchedule(sData.schedule || sData || []);
      setOverrides(oData.overrides || oData || []);
    };

    load();
  }, [barberId]);

  // =========================
  // 🔥 LOAD AVAILABILITY
  // =========================
  useEffect(() => {
    const loadAvailability = async () => {
      const today = new Date();
      const from = today.toISOString().slice(0, 10);

      const future = new Date();
      future.setDate(today.getDate() + 30);
      const to = future.toISOString().slice(0, 10);

      const res = await fetch(
        `/api/availability?barberId=${barberId}&from=${from}&to=${to}`
      );

      const data = await res.json();

      setAvailableDays(data.availableDays || []);
    };

    loadAvailability();
  }, [barberId]);

  // =========================
  // 🔥 LOAD SLOTS (CU CACHE)
  // =========================
  useEffect(() => {
    if (!date || !serviceId) return;

    const cacheKey = `${date}_${serviceId}`;

    if (slotsCache.current[cacheKey]) {
      setSlots(slotsCache.current[cacheKey]);
      return;
    }

    setLoadingSlots(true);

    fetch(
      `/api/slots?barberId=${barberId}&date=${date}&serviceId=${serviceId}`
    )
      .then((r) => r.json())
      .then((d) => {
        const result = d.slots || [];

        slotsCache.current[cacheKey] = result;

        setSlots(result);
        setSelectedSlot(null);
      })
      .finally(() => setLoadingSlots(false));
  }, [date, serviceId, barberId]);

  // =========================
  // 🔥 CREATE BOOKING
  // =========================
  const createBooking = async () => {
    if (!selectedSlot || !date || !serviceId) {
      setError("Completează toate datele");
      return;
    }

    const service = services.find((s) => s.id === serviceId);
    const duration = service?.duration || 30;

    const [h, m] = selectedSlot.split(":").map(Number);
    const d = new Date();
    d.setHours(h);
    d.setMinutes(m + duration);

    const endTime = d.toTimeString().slice(0, 5);

    const hold = await fetch("/api/bookings/hold", {
      method: "POST",
      body: JSON.stringify({
        barber_id: barberId,
        barber_service_id: serviceId,
        date,
        start_time: selectedSlot,
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

    const createData = await create.json();

    router.push(`/booking/confirmed/${createData.bookingId}`);
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">

      <div className="text-center">
        <h1 className="text-3xl font-semibold">
          Programează-te
        </h1>
        <p className="text-gray-500 mt-1">
          la <span className="font-medium text-black">{barberName}</span>
        </p>
      </div>

      <Calendar
        value={date}
        onChange={setDate}
        weeklySchedule={weeklySchedule}
        overrides={overrides}
        availableDays={availableDays}
      />

      {date && (
        <div className="space-y-3">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => setServiceId(s.id)}
              className={`
                w-full p-4 rounded-xl border transition text-left
                ${serviceId === s.id
                  ? "bg-black text-white"
                  : "bg-white hover:bg-gray-50"}
              `}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    {s.display_name || s.name}
                  </div>
                  {s.duration && (
                    <div className="text-xs text-gray-400">
                      {s.duration} min
                    </div>
                  )}
                </div>

                {s.price && (
                  <div className="text-sm font-medium">
                    {s.price} lei
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {(loadingSlots || slots.length > 0) && (
        <SlotPicker
          slots={slots}
          selected={selectedSlot}
          onSelect={setSelectedSlot}
          loading={loadingSlots}
        />
      )}

      {selectedSlot && (
        <div className="space-y-3">

          <input
            placeholder="Nume"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border rounded-xl"
          />

          <input
            placeholder="Telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-3 border rounded-xl"
          />

          <input
            placeholder="Email (opțional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-xl"
          />

          <button
            onClick={createBooking}
            className="w-full bg-black text-white p-3 rounded-xl"
          >
            Programează-te
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
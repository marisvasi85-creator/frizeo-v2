"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";
import { Slot } from "@/types/slots"; // 🔥 FOLOSEȘTI TIP GLOBAL

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
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);

  const [loadingSlots, setLoadingSlots] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bookingLoading, setBookingLoading] =
  useState(false);

const [bookingSuccess, setBookingSuccess] =
  useState(false);

  const slotsCache = useRef<Record<string, Slot[]>>({});
  const servicesRef = useRef<HTMLDivElement>(null);
const slotsRef = useRef<HTMLDivElement>(null);
const formRef = useRef<HTMLDivElement>(null);
  // =========================
  // SERVICES
  // =========================
  useEffect(() => {
  fetch(`/api/services?barberId=${barberId}`)
    .then((r) => r.json())
    .then((d) => {
      console.log("SERVICES API:", d);
      console.log("SERVICES ARRAY:", d.services);

      setServices(d.services || []);
    });
}, [barberId]);

  // =========================
  // AVAILABILITY
  // =========================
  useEffect(() => {
    const load = async () => {
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
      setWeeklySchedule(data.weeklySchedule || []);
      setOverrides(data.overrides || []);
    };

    load();
  }, [barberId]);

  // =========================
  // SLOTS (CORE FIX)
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
      `/api/slots?barberId=${barberId}&date=${date}&serviceId=${serviceId}&mode=public`
    )
      .then((r) => r.json())
      .then((d) => {
        const fixed: Slot[] = (d.slots || [])
          .map((s: any) => {
            if (s.type === "booking") {
              return {
                type: "booking",
                time: s.time,
                end:
                  s.end ||
                  s.booking?.end_time?.slice(0, 5) ||
                  s.time,
                booking: s.booking,
              };
            }

            if (s.type === "break") {
              return {
                type: "break",
                start: s.start,
                end: s.end,
              };
            }

            return {
              type: "free",
              time: s.time,
            };
          })
          // 🔥 PUBLIC → DOAR SLOTURI LIBERE
          .filter((s: Slot) => s.type === "free");

        slotsCache.current[cacheKey] = fixed;

        setSlots(fixed);
        setSelectedSlot(null);
      })
      .finally(() => setLoadingSlots(false));
  }, [date, serviceId, barberId]);

  // =========================
  // CREATE BOOKING
  // =========================
  const createBooking = async () => {
    console.log("CLICK");
  if (!selectedSlot || !date || !serviceId) return;

  setBookingLoading(true);
    console.log("LOADING TRUE");

    const service = services.find((s) => s.id === serviceId);
    const duration = service?.duration || 30;

    const [y, m, dDay] = date.split("-").map(Number);
    const [h, min] = selectedSlot.split(":").map(Number);

    const d = new Date(y, m - 1, dDay);
    d.setHours(h);
    d.setMinutes(min + duration);

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

    setBookingLoading(false);
setBookingSuccess(true);

setTimeout(() => {
  router.push(
    `/booking/confirmed/${createData.bookingId}`
  );
}, 500);
  }
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
  onChange={(value: string) => {
    setDate(value);

    setTimeout(() => {
      servicesRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 200);
  }}
  weeklySchedule={weeklySchedule}
  overrides={overrides}
  availableDays={availableDays}
/>

      {date && (
  <div
    ref={servicesRef}
    className="space-y-3"
  >
    {services.map((s) => (
      <button
        key={s.id}
        type="button"
        onClick={() => {
  setServiceId(s.id);

  setTimeout(() => {
    slotsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 300);
}}
        className={`w-full p-4 rounded-xl border transition ${
          serviceId === s.id
            ? "bg-black text-white"
            : "bg-white hover:bg-gray-50"
        }`}
      >
        {s.display_name} ({s.duration} min)
      </button>
    ))}
  </div>
)}

      {(loadingSlots || slots.length > 0) && (
  <div ref={slotsRef}>
    <SlotPicker
      slots={slots}
      selected={selectedSlot}
      onSelect={(slot) => {
        setSelectedSlot(slot);

        setTimeout(() => {
          formRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 200);
      }}
      loading={loadingSlots}
    />
  </div>
)}

      {selectedSlot && (
  <div
    ref={formRef}
    className="space-y-3"
  >
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
  disabled={bookingLoading}
  className="w-full bg-black text-white p-3 rounded-xl disabled:opacity-70"
>
  {bookingLoading
    ? "Se salvează programarea..."
    : bookingSuccess
    ? "Programare salvată ✓"
    : "Programează-te"}
</button>
        </div>
      )}
    </div>
  );
}
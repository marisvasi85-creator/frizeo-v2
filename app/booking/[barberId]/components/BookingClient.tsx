"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";
import VacationNotice from "@/app/components/VacationNotice";
import type { VacationPeriod } from "@/lib/schedule/vacationPeriods";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { Slot } from "@/types/slots";

function isValidPhone(phone: string) {
  return /^(\+40|0)[0-9]{9}$/.test(phone.replace(/\s/g, ""));
}

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
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [servicesError, setServicesError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");

  const slotsCache = useRef<Record<string, Slot[]>>({});
  const calendarRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/services?barberId=${barberId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.services?.length) {
          setServicesError("Nu există servicii disponibile momentan.");
        }
        setServices(d.services || []);
      })
      .catch(() => setServicesError("Nu am putut încărca serviciile."));
  }, [barberId]);

  useEffect(() => {
    if (!serviceId) {
      setAvailableDays([]);
      setWeeklySchedule([]);
      setOverrides([]);
      setVacationPeriods([]);
      return;
    }

    const load = async () => {
      setLoadingAvailability(true);

      const from = getTodayInBookingTimezone();
      const to = addDaysToDateString(from, 30);

      try {
        const res = await fetch(
          `/api/availability?barberId=${barberId}&from=${from}&to=${to}&serviceId=${serviceId}`,
        );
        const data = await res.json();

        setAvailableDays(data.availableDays || []);
        setWeeklySchedule(data.weeklySchedule || []);
        setOverrides(data.overrides || []);
        setVacationPeriods(data.vacationPeriods || []);
      } finally {
        setLoadingAvailability(false);
      }
    };

    load();
  }, [barberId, serviceId]);

  useEffect(() => {
    if (date && availableDays.length > 0 && !availableDays.includes(date)) {
      setDate(null);
      setSelectedSlot(null);
      setSlots([]);
    }
  }, [availableDays, date]);

  useEffect(() => {
    if (!date || !serviceId) return;

    const cacheKey = `${date}_${serviceId}`;
    const isToday = date === getTodayInBookingTimezone();

    if (slotsCache.current[cacheKey] && !isToday) {
      setSlots(slotsCache.current[cacheKey]);
      return;
    }

    setLoadingSlots(true);

    fetch(
      `/api/slots?barberId=${barberId}&date=${date}&serviceId=${serviceId}&mode=public`,
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
              return { type: "break", start: s.start, end: s.end };
            }

            return { type: "free", time: s.time };
          })
          .filter((s: Slot) => s.type === "free");

        slotsCache.current[cacheKey] = fixed;
        setSlots(fixed);
        setSelectedSlot(null);
      })
      .finally(() => setLoadingSlots(false));
  }, [date, serviceId, barberId]);

  const createBooking = async () => {
    setBookingError("");

    if (!selectedSlot || !date || !serviceId) return;

    if (!name.trim()) {
      setBookingError("Numele este obligatoriu.");
      return;
    }

    if (!isValidPhone(phone)) {
      setBookingError("Introdu un număr de telefon valid (ex: 07xxxxxxxx).");
      return;
    }

    setBookingLoading(true);

    try {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barber_id: barberId,
          barber_service_id: serviceId,
          date,
          start_time: selectedSlot,
          end_time: endTime,
        }),
      });

      const holdData = await hold.json();

      if (!hold.ok) {
        setBookingError(holdData.error || "Slotul nu mai este disponibil.");
        return;
      }

      const create = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: holdData.holdId,
          client_name: name.trim(),
          client_phone: phone.replace(/\s/g, ""),
          client_email: email.trim() || null,
          client_notes: notes.trim() || null,
        }),
      });

      const createData = await create.json();

      if (!create.ok) {
        setBookingError(createData.error || "Nu am putut salva programarea.");
        return;
      }

      router.push(`/booking/confirmed/${createData.bookingId}`);
    } catch {
      setBookingError("Eroare de conexiune. Încearcă din nou.");
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Programează-te</h1>
        <p className="text-gray-500 mt-1">
          la <span className="font-medium text-black">{barberName}</span>
        </p>
      </div>

      {servicesError && (
        <p className="text-red-600 text-sm text-center">{servicesError}</p>
      )}

      {services.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500 font-medium">1. Alege serviciul</p>
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setServiceId(s.id);
                setDate(null);
                setSelectedSlot(null);
                setSlots([]);
                setTimeout(() => {
                  calendarRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }, 200);
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

      {serviceId && (
        <div ref={calendarRef} className="space-y-3">
          <p className="text-sm text-gray-500 font-medium">2. Alege data</p>
          {loadingAvailability ? (
            <p className="text-sm text-gray-400 text-center">
              Se încarcă zilele disponibile...
            </p>
          ) : availableDays.length === 0 ? (
            <div className="space-y-3">
              {vacationPeriods.length > 0 && (
                <VacationNotice periods={vacationPeriods} />
              )}
              <p className="text-sm text-gray-500 text-center">
                {vacationPeriods.length > 0
                  ? "Nu sunt locuri disponibile în următoarele 30 de zile (concediu sau program complet)."
                  : "Nu mai sunt locuri disponibile în următoarele 30 de zile pentru acest serviciu."}
              </p>
            </div>
          ) : (
            <>
              {vacationPeriods.length > 0 && (
                <VacationNotice periods={vacationPeriods} />
              )}
              <Calendar
                value={date}
                onChange={(value: string) => {
                  setDate(value);
                  setTimeout(() => {
                    slotsRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 200);
                }}
                weeklySchedule={weeklySchedule}
                overrides={overrides}
                availableDays={availableDays}
                enforceAvailableDays
              />
              <p className="text-xs text-gray-400 text-center">
                Zilele verzi au locuri libere pentru serviciul selectat.
              </p>
            </>
          )}
        </div>
      )}

      {serviceId && date && (loadingSlots || slots.length > 0) && (
        <div ref={slotsRef} className="space-y-3">
          <p className="text-sm text-gray-500 font-medium">3. Alege ora</p>
          <SlotPicker
            variant="light"
            slots={slots}
            selected={selectedSlot}
            onSelect={(slot) => {
              setSelectedSlot(slot);
              setTimeout(() => {
                formRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }, 200);
            }}
            loading={loadingSlots}
          />
        </div>
      )}

      {serviceId && date && !loadingSlots && slots.length === 0 && (
        <p className="text-gray-500 text-sm text-center">
          Nu mai sunt locuri disponibile în această zi. Alege altă dată.
        </p>
      )}

      {selectedSlot && (
        <div ref={formRef} className="space-y-3">
          <p className="text-sm text-gray-500 font-medium">4. Datele tale</p>

          <input
            placeholder="Nume complet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border rounded-xl"
          />

          <input
            placeholder="Telefon (07xxxxxxxx)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-3 border rounded-xl"
          />

          <input
            placeholder="Email (opțional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 border rounded-xl"
          />

          <textarea
            placeholder="Mentiuni (opțional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-3 border rounded-xl resize-y min-h-[80px]"
          />

          {bookingError && (
            <p className="text-red-600 text-sm">{bookingError}</p>
          )}

          <button
            type="button"
            onClick={createBooking}
            disabled={bookingLoading}
            className="w-full bg-black text-white p-3 rounded-xl disabled:opacity-70"
          >
            {bookingLoading ? "Se salvează programarea..." : "Confirmă programarea"}
          </button>
        </div>
      )}
    </div>
  );
}

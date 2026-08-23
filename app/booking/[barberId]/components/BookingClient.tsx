"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Calendar from "@/app/components/Calendar";
import SlotPicker from "@/app/components/SlotPicker";
import VacationNotice from "@/app/components/VacationNotice";
import type { VacationPeriod } from "@/lib/schedule/vacationPeriods";
import { SELECT_SERVICE_FIRST_MESSAGE } from "@/lib/bookings/bookingMessages";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { Slot } from "@/types/slots";
import {
  loadSavedClientDetails,
  saveSavedClientDetails,
} from "@/lib/bookings/savedClientDetails";
import BookingAccessPrompt from "@/app/booking/_components/BookingAccessPrompt";
import type { BookingAccessMode } from "@/lib/barber-access/types";
import { isValidRomanianPhone } from "@/lib/phone/normalizeRomanianPhone";

function isValidPhone(phone: string) {
  return isValidRomanianPhone(phone);
}

export default function BookingClient({
  barberId,
  barberName,
  accessMode = "open",
}: {
  barberId: string;
  barberName: string;
  accessMode?: BookingAccessMode;
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
  const [serviceFirstError, setServiceFirstError] = useState("");

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [servicesError, setServicesError] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [accessGranted, setAccessGranted] = useState(accessMode === "open");

  const slotsCache = useRef<Record<string, Slot[]>>({});
  const calendarRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadSavedClientDetails();
    if (saved) {
      setName(saved.name);
      setPhone(saved.phone);
      setEmail(saved.email);
    }
  }, []);

  useEffect(() => {
    if (!accessGranted) return;
    const ac = new AbortController();

    fetch(`/api/services?barberId=${barberId}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (!d.services?.length) {
          setServicesError("Nu există servicii disponibile momentan.");
        }
        setServices(d.services || []);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setServicesError("Nu am putut încărca serviciile.");
      });

    return () => ac.abort();
  }, [barberId, accessGranted]);

  useEffect(() => {
    if (!accessGranted) return;
    const ac = new AbortController();

    const load = async () => {
      setLoadingAvailability(true);

      const from = getTodayInBookingTimezone();
      const to = addDaysToDateString(from, 30);
      const params = new URLSearchParams({
        barberId,
        from,
        to,
      });

      if (serviceId) {
        params.set("serviceId", serviceId);
      }

      try {
        const res = await fetch(`/api/availability?${params.toString()}`, {
          signal: ac.signal,
        });
        const data = await res.json();

        setAvailableDays(data.availableDays || []);
        setWeeklySchedule(data.weeklySchedule || []);
        setOverrides(data.overrides || []);
        setVacationPeriods(data.vacationPeriods || []);
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
      } finally {
        if (!ac.signal.aborted) {
          setLoadingAvailability(false);
        }
      }
    };

    load();
    return () => ac.abort();
  }, [barberId, serviceId, accessGranted]);

  useEffect(() => {
    if (!serviceId || !date) return;

    if (availableDays.length > 0 && !availableDays.includes(date)) {
      setDate(null);
      setSelectedSlot(null);
      setSlots([]);
    }
  }, [availableDays, date, serviceId]);

  useEffect(() => {
    if (!accessGranted) return;
    if (!date || !serviceId) return;

    const cacheKey = `${date}_${serviceId}`;
    const isToday = date === getTodayInBookingTimezone();

    if (slotsCache.current[cacheKey] && !isToday) {
      setSlots(slotsCache.current[cacheKey]);
      return;
    }

    const ac = new AbortController();
    setLoadingSlots(true);

    fetch(
      `/api/slots?barberId=${barberId}&date=${date}&serviceId=${serviceId}&mode=public`,
      { signal: ac.signal },
    )
      .then((r) => r.json())
      .then((d) => {
        if (ac.signal.aborted) return;

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
      .catch((err) => {
        if (err?.name === "AbortError") return;
      })
      .finally(() => {
        if (!ac.signal.aborted) {
          setLoadingSlots(false);
        }
      });

    return () => ac.abort();
  }, [date, serviceId, barberId, accessGranted]);

  function handleDateChange(value: string) {
    if (!serviceId) {
      setServiceFirstError(SELECT_SERVICE_FIRST_MESSAGE);
      return;
    }

    setServiceFirstError("");
    setDate(value);

    setTimeout(() => {
      slotsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 200);
  }

  function handleServiceSelect(id: string) {
    setServiceId(id);
    setServiceFirstError("");
    setDate(null);
    setSelectedSlot(null);
    setSlots([]);

    setTimeout(() => {
      calendarRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 200);
  }

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
          client_phone: phone,
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

      saveSavedClientDetails({
        name: name.trim(),
        phone: phone.replace(/\s/g, ""),
        email: email.trim(),
      });

      const tokenQs = createData.cancelToken
        ? `?t=${encodeURIComponent(createData.cancelToken)}`
        : "";
      router.push(`/booking/confirmed/${createData.bookingId}${tokenQs}`);
    } catch {
      setBookingError("Eroare de conexiune. Încearcă din nou.");
    } finally {
      setBookingLoading(false);
    }
  };

  if (!accessGranted && accessMode !== "open") {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-6 text-frz-ink">
        <div className="text-center">
          <h1 className="text-3xl font-semibold">Programează-te</h1>
          <p className="text-frz-muted mt-1">
            la <span className="font-medium text-frz-ink">{barberName}</span>
          </p>
        </div>
        <BookingAccessPrompt
          barberId={barberId}
          mode={accessMode}
          presentation="embedded"
          onApproved={(details) => {
            setName(details.name);
            setPhone(details.phone);
            setEmail(details.email);
            setAccessGranted(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6 text-frz-ink">
      <div className="text-center">
        <h1 className="text-3xl font-semibold">Programează-te</h1>
        <p className="text-frz-muted mt-1">
          la <span className="font-medium text-frz-ink">{barberName}</span>
        </p>
      </div>

      {servicesError && (
        <p className="text-frz-danger text-sm text-center">{servicesError}</p>
      )}

      {services.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-frz-muted font-medium">1. Alege serviciul</p>
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleServiceSelect(s.id)}
              className={`w-full p-4 rounded-xl border border-frz-line transition ${
                serviceId === s.id
                  ? "bg-frz-ink text-frz-ink-contrast border-frz-ink"
                  : "bg-frz-card hover:bg-frz-fog text-frz-ink"
              }`}
            >
              {s.display_name} ({s.duration} min)
            </button>
          ))}
        </div>
      )}

      {services.length > 0 && (
        <div ref={calendarRef} className="space-y-3">
          <p className="text-sm text-frz-muted font-medium">2. Alege data</p>

          {serviceFirstError && (
            <p className="text-frz-danger text-sm text-center">
              {serviceFirstError}
            </p>
          )}

          {loadingAvailability ? (
            <p className="text-sm text-frz-muted text-center">
              Se încarcă zilele disponibile...
            </p>
          ) : serviceId && availableDays.length === 0 ? (
            <div className="space-y-3">
              {vacationPeriods.length > 0 && (
                <VacationNotice periods={vacationPeriods} />
              )}
              <p className="text-sm text-frz-muted text-center">
                {vacationPeriods.length > 0
                  ? "Nu sunt locuri disponibile în următoarele 30 de zile (concediu sau program complet)."
                  : "Nu mai sunt locuri disponibile în următoarele 30 de zile pentru acest serviciu."}
              </p>
            </div>
          ) : (
            <>
              {serviceId && vacationPeriods.length > 0 && (
                <VacationNotice periods={vacationPeriods} />
              )}
              <Calendar
                value={date}
                onChange={handleDateChange}
                weeklySchedule={weeklySchedule}
                overrides={overrides}
                availableDays={serviceId ? availableDays : []}
                enforceAvailableDays={!!serviceId}
              />
              {serviceId && (
                <p className="text-xs text-frz-muted text-center">
                  Zilele verzi au locuri libere pentru serviciul selectat.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {serviceId && date && (loadingSlots || slots.length > 0) && (
        <div ref={slotsRef} className="space-y-3">
          <p className="text-sm text-frz-muted font-medium">3. Alege ora</p>
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
        <p className="text-frz-muted text-sm text-center">
          Nu mai sunt locuri disponibile în această zi. Alege altă dată.
        </p>
      )}

      {selectedSlot && (
        <div ref={formRef} className="space-y-3">
          <p className="text-sm text-frz-muted font-medium">4. Datele tale</p>

          <input
            placeholder="Nume complet"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="w-full p-3 border border-frz-line rounded-xl bg-frz-card text-frz-ink placeholder:text-frz-muted outline-none transition focus:ring-2 focus:ring-frz-ink/10 focus:border-frz-ink/25"
          />

          <input
            placeholder="Telefon (07xxxxxxxx)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            className="w-full p-3 border border-frz-line rounded-xl bg-frz-card text-frz-ink placeholder:text-frz-muted outline-none transition focus:ring-2 focus:ring-frz-ink/10 focus:border-frz-ink/25"
          />

          <input
            placeholder="Email (opțional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full p-3 border border-frz-line rounded-xl bg-frz-card text-frz-ink placeholder:text-frz-muted outline-none transition focus:ring-2 focus:ring-frz-ink/10 focus:border-frz-ink/25"
          />

          <textarea
            placeholder="Mentiuni (opțional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-3 border border-frz-line rounded-xl resize-y min-h-[80px] bg-frz-card text-frz-ink placeholder:text-frz-muted outline-none transition focus:ring-2 focus:ring-frz-ink/10 focus:border-frz-ink/25"
          />

          {bookingError && (
            <p className="text-frz-danger text-sm">{bookingError}</p>
          )}

          <button
            type="button"
            onClick={createBooking}
            disabled={bookingLoading}
            className="w-full bg-frz-ink text-frz-ink-contrast p-3 rounded-xl disabled:opacity-70"
          >
            {bookingLoading ? "Se salvează programarea..." : "Confirmă programarea"}
          </button>
        </div>
      )}
    </div>
  );
}

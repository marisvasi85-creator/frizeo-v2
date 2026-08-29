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
import type {
  BookingAccessMode,
  PublicAccessStatus,
} from "@/lib/barber-access/types";
import { isValidRomanianPhone } from "@/lib/phone/normalizeRomanianPhone";

function isValidPhone(phone: string) {
  return isValidRomanianPhone(phone);
}

type BookingService = {
  id: string;
  display_name: string;
  duration: number;
};

type WeeklyScheduleRow = {
  day_of_week: number;
  is_working?: boolean | null;
};

type DayOverrideRow = {
  date: string;
  is_closed?: boolean | null;
  [key: string]: unknown;
};

type RawSlot = {
  type: string;
  time?: string;
  end?: string;
  start?: string;
  booking?: { end_time?: string | null };
};

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

  const [services, setServices] = useState<BookingService[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklyScheduleRow[]>([]);
  const [overrides, setOverrides] = useState<DayOverrideRow[]>([]);
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
  const [accessStatus, setAccessStatus] = useState<PublicAccessStatus | null>(null);
  const [referral, setReferral] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);

  const slotsCache = useRef<Record<string, Slot[]>>({});
  const calendarRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const bookingInFlight = useRef(false);

  useEffect(() => {
    const saved = loadSavedClientDetails();
    if (saved) {
      setName(saved.name);
      setPhone(saved.phone);
      setEmail(saved.email);
    }
  }, []);

  useEffect(() => {
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
  }, [barberId]);

  useEffect(() => {
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
  }, [barberId, serviceId]);

  useEffect(() => {
    if (!serviceId || !date) return;

    if (availableDays.length > 0 && !availableDays.includes(date)) {
      setDate(null);
      setSelectedSlot(null);
      setSlots([]);
    }
  }, [availableDays, date, serviceId]);

  useEffect(() => {
    if (!date || !serviceId) return;

    const cacheKey = `${date}_${serviceId}`;
    const isToday = date === getTodayInBookingTimezone();

    if (slotsCache.current[cacheKey] && !isToday) {
      setSlots(slotsCache.current[cacheKey]);
      setLoadingSlots(false);
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

        const fixed: Slot[] = ((d.slots || []) as RawSlot[])
          .map((s): Slot | null => {
            if (s.type === "booking") {
              if (!s.time) return null;
              return {
                type: "booking",
                time: s.time,
                end:
                  s.end ||
                  s.booking?.end_time?.slice(0, 5) ||
                  s.time,
                booking: s.booking ?? {},
              };
            }

            if (s.type === "break") {
              if (!s.start || !s.end) return null;
              return { type: "break", start: s.start, end: s.end };
            }

            if (!s.time) return null;
            return { type: "free", time: s.time };
          })
          .filter((s): s is Extract<Slot, { type: "free" }> => s?.type === "free");

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
  }, [date, serviceId, barberId]);

  async function submitAccessRequest() {
    setBookingError("");

    if (!name.trim() || !isValidPhone(phone)) {
      setBookingError("Completează numele și un număr de telefon valid.");
      return;
    }

    setRequestLoading(true);
    try {
      const response = await fetch("/api/public/barber-access/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId,
          name: name.trim(),
          phone,
          email: email.trim() || null,
          referral: referral.trim() || null,
          message: requestMessage.trim() || null,
        }),
      });
      const data = await response.json();

      if (data.status) setAccessStatus(data.status as PublicAccessStatus);
      if (!response.ok) {
        setBookingError(data.error || "Nu am putut trimite solicitarea.");
        return;
      }

      saveSavedClientDetails({
        name: name.trim(),
        phone: phone.replace(/\s/g, ""),
        email: email.trim(),
      });
      setBookingError(data.message || "Cererea a fost trimisă.");
    } catch {
      setBookingError("Eroare de conexiune. Încearcă din nou.");
    } finally {
      setRequestLoading(false);
    }
  }

  function handleDateChange(value: string) {
    if (!serviceId) {
      setServiceFirstError(SELECT_SERVICE_FIRST_MESSAGE);
      return;
    }

    setServiceFirstError("");
    setDate(value);
    setSelectedSlot(null);
    setSlots([]);
    setLoadingSlots(true);

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
    if (bookingInFlight.current) return;

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

    bookingInFlight.current = true;
    setBookingLoading(true);

    let succeeded = false;

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
        if (holdData.accessStatus) {
          setAccessStatus(holdData.accessStatus as PublicAccessStatus);
        }
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
        if (createData.accessStatus) {
          setAccessStatus(createData.accessStatus as PublicAccessStatus);
        }
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
      succeeded = true;
    } catch {
      setBookingError("Eroare de conexiune. Încearcă din nou.");
    } finally {
      if (!succeeded) bookingInFlight.current = false;
      setBookingLoading(false);
    }
  };

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
        <div
          className={`space-y-3 rounded-2xl p-1 ${
            !serviceId ? "ring-2 ring-frz-accent/35 ring-offset-2 ring-offset-frz-bg" : ""
          }`}
        >
          <p
            className={`text-base font-bold text-frz-ink ${
              !serviceId ? "animate-frz-attention" : ""
            }`}
          >
            1. Alege serviciul
          </p>
          {!serviceId && (
            <p className="text-sm font-medium text-frz-accent animate-frz-attention">
              Începe de aici — selectează serviciul dorit
            </p>
          )}
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => handleServiceSelect(s.id)}
              className={`w-full p-4 rounded-xl border border-frz-line transition ${
                serviceId === s.id
                  ? "bg-frz-ink text-frz-ink-contrast border-frz-ink"
                  : !serviceId
                    ? "bg-frz-card hover:bg-frz-fog text-frz-ink shadow-sm"
                    : "bg-frz-card hover:bg-frz-fog text-frz-ink"
              }`}
            >
              <span className={!serviceId ? "font-semibold" : undefined}>
                {s.display_name} ({s.duration} min)
              </span>
            </button>
          ))}
        </div>
      )}

      {services.length > 0 && (
        <div ref={calendarRef} className="space-y-3">
          <p
            className={
              serviceId && loadingAvailability
                ? "text-base font-bold text-frz-ink animate-frz-attention"
                : "text-sm font-medium text-frz-muted"
            }
          >
            2. Alege data
          </p>

          {serviceFirstError && (
            <p className="text-frz-danger text-sm text-center">
              {serviceFirstError}
            </p>
          )}

          {loadingAvailability ? (
            <div
              className="rounded-2xl border border-frz-accent/30 bg-frz-accent-soft/40 p-4 space-y-4"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="text-center text-base font-bold text-frz-ink animate-frz-attention">
                Se încarcă zilele disponibile...
              </p>
              <p className="text-center text-sm font-medium text-frz-steel animate-frz-loading-glow">
                Te rugăm să aștepți — pregătim calendarul
              </p>
              <div className="rounded-xl border border-frz-line bg-frz-card p-3 space-y-2">
                <div className="h-4 w-1/3 mx-auto rounded bg-frz-fog animate-pulse" />
                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: 28 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-square rounded-lg bg-frz-fog animate-pulse"
                      style={{ animationDelay: `${(i % 7) * 60}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
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
          <p
            className={
              loadingSlots
                ? "text-base font-bold text-frz-ink animate-frz-attention"
                : "text-sm font-medium text-frz-muted"
            }
          >
            3. Alege ora
          </p>
          {loadingSlots && (
            <div
              className="rounded-2xl border border-frz-accent/30 bg-frz-accent-soft/40 p-4 space-y-3"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="text-center text-base font-bold text-frz-ink animate-frz-attention">
                Se încarcă orele disponibile...
              </p>
              <p className="text-center text-sm font-medium text-frz-steel animate-frz-loading-glow">
                Pregătim locurile libere pentru ziua selectată
              </p>
              <SlotPicker
                variant="light"
                slots={[]}
                selected={null}
                onSelect={() => {}}
                loading
              />
            </div>
          )}
          {!loadingSlots && (
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
              loading={false}
            />
          )}
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
            onChange={(e) => {
              setPhone(e.target.value);
              setAccessStatus(null);
              setBookingError("");
            }}
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
            <p
              className={`rounded-xl border p-3 text-sm ${
                accessStatus === "pending"
                  ? "border-amber-300/50 bg-amber-500/10 text-frz-ink"
                  : "border-frz-danger/30 bg-frz-danger/5 text-frz-danger"
              }`}
            >
              {bookingError}
            </p>
          )}

          {accessMode === "approval_required" && accessStatus === "not_found" && (
            <div className="space-y-3 rounded-2xl border border-frz-line bg-frz-fog p-4">
              <div>
                <p className="font-medium">Solicită acces pentru programări</p>
                <p className="mt-1 text-sm text-frz-muted">
                  Folosim numele, telefonul și e-mailul completate mai sus. Poți adăuga opțional o recomandare sau un mesaj.
                </p>
              </div>
              <input
                value={referral}
                onChange={(event) => setReferral(event.target.value)}
                placeholder="Cine te-a recomandat? (opțional)"
                maxLength={240}
                className="w-full rounded-xl border border-frz-line bg-frz-card p-3 text-frz-ink outline-none focus:border-frz-ink/30 focus:ring-2 focus:ring-frz-ink/10"
              />
              <textarea
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                placeholder="Mesaj pentru frizer (opțional)"
                rows={3}
                maxLength={1200}
                className="w-full resize-y rounded-xl border border-frz-line bg-frz-card p-3 text-frz-ink outline-none focus:border-frz-ink/30 focus:ring-2 focus:ring-frz-ink/10"
              />
              <button
                type="button"
                onClick={() => void submitAccessRequest()}
                disabled={requestLoading}
                className="w-full rounded-xl border border-frz-ink bg-frz-card px-4 py-3 font-medium text-frz-ink disabled:opacity-60"
              >
                {requestLoading ? "Se trimite solicitarea..." : "Trimite solicitarea"}
              </button>
            </div>
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

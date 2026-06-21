"use client";

import { useEffect, useRef, useState } from "react";
import Calendar from "@/app/components/Calendar";

type ApiSlot = {
  type: "free" | "booking" | "break";
  time?: string;
  start?: string;
  end?: string;
  booking?: {
    id: string;
    client_name?: string;
  };
};

type Booking = {
  id: string;
  barber_id: string;
  barber_service_id: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  date: string;
  start_time: string;
  end_time: string;
  reschedule_token: string;
  barber?: { display_name?: string };
  barber_services?: {
    display_name?: string;
    name?: string;
    duration?: number;
  };
};

const inputClass =
  "w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3 text-white";

function normTime(t: string) {
  return t.slice(0, 5);
}

export default function EditBookingModal({
  booking,
  onClose,
  onSaved,
  onCancelled,
}: {
  booking: Booking;
  onClose: () => void;
  onSaved: () => void;
  onCancelled?: () => void;
}) {
  const originalDate = booking.date;
  const originalTime = normTime(booking.start_time);

  const [name, setName] = useState(booking.client_name);
  const [phone, setPhone] = useState(booking.client_phone || "");
  const [email, setEmail] = useState(booking.client_email || "");
  const [date, setDate] = useState(booking.date);
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(originalTime);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState("");
  const slotsRef = useRef<HTMLDivElement>(null);

  const serviceName =
    booking.barber_services?.display_name ||
    booking.barber_services?.name ||
    "Serviciu";

  const barberName = booking.barber?.display_name || "Frizer";

  useEffect(() => {
    async function loadAvailability() {
      const today = new Date();
      const from = localDateISO(today);
      const future = new Date();
      future.setDate(future.getDate() + 60);
      const to = localDateISO(future);

      const res = await fetch(
        `/api/availability?barberId=${booking.barber_id}&from=${from}&to=${to}`
      );
      const data = await res.json();

      const days: string[] = data.availableDays || [];
      if (!days.includes(originalDate)) {
        days.push(originalDate);
      }

      setAvailableDays(days);
      setWeeklySchedule(data.weeklySchedule || []);
      setOverrides(data.overrides || []);
    }

    loadAvailability();
  }, [booking.barber_id, originalDate]);

  useEffect(() => {
    if (!date) return;

    setSlotsLoading(true);

    fetch(
      `/api/slots?barberId=${booking.barber_id}&date=${date}&serviceId=${booking.barber_service_id}&mode=admin&excludeBookingId=${booking.id}`
    )
      .then((r) => r.json())
      .then((data) => {
        const loaded: ApiSlot[] = Array.isArray(data?.slots) ? data.slots : [];
        setSlots(loaded);

        if (date === originalDate) {
          setSelectedSlot(originalTime);
        } else {
          const firstFree = loaded.find((s) => s.type === "free");
          setSelectedSlot(firstFree?.time || null);
        }
      })
      .finally(() => setSlotsLoading(false));
  }, [
    date,
    booking.barber_id,
    booking.barber_service_id,
    booking.id,
    originalDate,
    originalTime,
  ]);

  const freeSlots = slots.filter((s) => s.type === "free");
  const isOriginalSlot =
    date === originalDate && selectedSlot === originalTime;
  const canSave =
    !!selectedSlot || (date === originalDate && !!originalTime);

  const displaySlots =
    slots.length > 0
      ? slots
      : date === originalDate
        ? [{ type: "free" as const, time: originalTime }]
        : [];

  async function handleSave() {
    const startTime =
      selectedSlot || (date === originalDate ? originalTime : null);

    if (!startTime) {
      setError("Alege un interval disponibil");
      return;
    }

    setLoading(true);
    setError("");

    const duration = booking.barber_services?.duration || 30;
    const endTime = addMinutes(startTime, duration);
    const unchanged =
      date === originalDate && startTime === originalTime;

    try {
      if (unchanged) {
        const res = await fetch("/api/bookings/update-full", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: booking.id,
            client_name: name,
            client_phone: phone,
            client_email: email || null,
            barber_service_id: booking.barber_service_id,
            date,
            start_time: startTime,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Eroare la salvare");
          setLoading(false);
          return;
        }
      } else {
        const res = await fetch("/api/bookings/reschedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: booking.reschedule_token,
            new_date: date,
            new_start_time: startTime,
            new_end_time: endTime,
            client_name: name,
            client_phone: phone,
            client_email: email,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Eroare la reprogramare");
          setLoading(false);
          return;
        }
      }

      onSaved();
      onClose();
    } catch {
      setError("Eroare server. Încearcă din nou.");
      setLoading(false);
    }
  }

  async function handleCancelBooking() {
    const ok = confirm(
      `Anulezi programarea lui ${booking.client_name} din ${originalDate} la ${originalTime}?`
    );

    if (!ok) return;

    setCancelling(true);
    setError("");

    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Nu s-a putut anula programarea");
      setCancelling(false);
      return;
    }

    onCancelled?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161618] border border-white/10 p-6 rounded-xl w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold">Editează programarea</h2>
          <p className="text-sm text-emerald-400 mt-1">
            {barberName} · {serviceName}
            {booking.barber_services?.duration
              ? ` (${booking.barber_services.duration} min)`
              : ""}
          </p>
        </div>

        <div className="text-xs text-white/50">
          Curent: {originalDate} {originalTime} – {normTime(booking.end_time)}
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <input
          placeholder="Nume client"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />

        <input
          placeholder="Telefon"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputClass}
        />

        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />

        <div className="rounded-xl border border-white/10 bg-[#0F0F10] p-3 edit-booking-calendar">
          <p className="text-xs text-white/50 mb-2 text-center">
            Zilele evidențiate au program activ
          </p>
          <Calendar
            value={date}
            onChange={setDate}
            weeklySchedule={weeklySchedule}
            overrides={overrides}
            availableDays={availableDays}
            allowDates={[originalDate]}
          />
        </div>

        <div ref={slotsRef}>
          <p className="text-sm text-white/70 mb-2">
            Intervale – {date}
            {slotsLoading && (
              <span className="text-white/40"> · se încarcă...</span>
            )}
          </p>

          {isOriginalSlot && freeSlots.length === 0 && !slotsLoading && (
            <p className="text-xs text-amber-400/90 mb-2">
              Programare la ora curentă ({originalTime}). Poți salva datele
              clientului sau alege altă oră/zi.
            </p>
          )}

          {!slotsLoading && displaySlots.length === 0 ? (
            <p className="text-sm text-white/50">
              Nu există intervale libere în această zi.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {displaySlots.map((s, index) => {
                if (s.type === "break") return null;

                const time = s.time || "";
                const isFree = s.type === "free";
                const isSelected = selectedSlot === time;
                const isCurrent =
                  date === originalDate && time === originalTime;

                return (
                  <button
                    key={`${s.type}-${time}-${index}`}
                    type="button"
                    disabled={!isFree}
                    onClick={() => isFree && setSelectedSlot(time)}
                    className={`py-2 rounded-lg text-sm transition ${
                      !isFree
                        ? "bg-red-500/80 text-white cursor-not-allowed"
                        : isSelected
                          ? "bg-white text-black"
                          : isCurrent
                            ? "bg-emerald-500/20 border border-emerald-500/40 text-white"
                            : "bg-[#0F0F10] border border-white/10 text-white hover:border-white/30"
                    }`}
                  >
                    <div className="font-semibold">{time}</div>
                    {!isFree && s.booking && (
                      <div className="text-xs opacity-80 truncate px-1">
                        {s.booking.client_name}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading || cancelling}
            className="flex-1 bg-white/10 py-3 rounded-lg text-white disabled:opacity-50"
          >
            Închide
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || loading || cancelling}
            className="flex-1 bg-white text-black py-3 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? "Se salvează..." : "Salvează"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleCancelBooking}
          disabled={loading || cancelling}
          className="w-full py-3 rounded-lg text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50"
        >
          {cancelling ? "Se anulează..." : "Anulează programarea"}
        </button>
      </div>

      <style jsx global>{`
        .edit-booking-calendar .rdp {
          --rdp-accent-color: #ffffff;
          --rdp-background-color: #27272a;
          color: #ffffff;
          margin: 0 auto;
        }
        .edit-booking-calendar .rdp-day_disabled {
          opacity: 0.25;
        }
        .edit-booking-calendar .rdp-caption_label,
        .edit-booking-calendar .rdp-weekday {
          color: rgba(255, 255, 255, 0.7);
        }
        .edit-booking-calendar .rdp-button:hover:not([disabled]) {
          background-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function localDateISO(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h);
  d.setMinutes(m + minutes);
  return d.toTimeString().slice(0, 5);
}

"use client";

import { useEffect, useRef, useState } from "react";

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
  barber_services?: {
    duration: number;
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
  const [name, setName] = useState(booking.client_name);
  const [phone, setPhone] = useState(booking.client_phone || "");
  const [email, setEmail] = useState(booking.client_email || "");
  const [date, setDate] = useState(booking.date);
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(
    normTime(booking.start_time)
  );
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");
  const slotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!date) return;

    fetch(
      `/api/slots?barberId=${booking.barber_id}&date=${date}&serviceId=${booking.barber_service_id}&mode=admin&excludeBookingId=${booking.id}`
    )
      .then((r) => r.json())
      .then((data) => {
        const loaded: ApiSlot[] = Array.isArray(data?.slots) ? data.slots : [];
        setSlots(loaded);

        const currentTime = normTime(booking.start_time);
        const currentStillFree = loaded.some(
          (s) => s.type === "free" && s.time === currentTime
        );

        if (date === booking.date && currentStillFree) {
          setSelectedSlot(currentTime);
        } else if (
          selectedSlot &&
          !loaded.some((s) => s.type === "free" && s.time === selectedSlot)
        ) {
          setSelectedSlot(null);
        }

        setTimeout(() => {
          slotsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      });
  }, [date, booking.barber_id, booking.barber_service_id, booking.date, booking.id, booking.start_time]);

  async function handleSave() {
    if (!selectedSlot) {
      setError("Alege un interval disponibil");
      return;
    }

    setLoading(true);
    setError("");

    const startTime = normTime(selectedSlot);
    const duration = booking.barber_services?.duration || 30;
    const endTime = addMinutes(startTime, duration);
    const unchanged =
      date === booking.date &&
      startTime === normTime(booking.start_time);

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
    const time = normTime(booking.start_time);
    const ok = confirm(
      `Anulezi programarea lui ${booking.client_name} din ${booking.date} la ${time}?`
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

  const displaySlots = slots.filter((s) => s.type !== "break");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161618] border border-white/10 p-6 rounded-xl w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold">Editează programarea</h2>

        <div className="text-xs text-white/50">
          Curent: {booking.date} {normTime(booking.start_time)} –{" "}
          {normTime(booking.end_time)}
        </div>

        {error && (
          <div className="bg-red-500/20 text-red-400 p-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <input
          placeholder="Nume"
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

        <input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedSlot(null);
          }}
          className={inputClass}
        />

        {displaySlots.length === 0 ? (
          <p className="text-sm text-white/50">
            Nu există intervale disponibile în această zi.
          </p>
        ) : (
          <div ref={slotsRef} className="grid grid-cols-3 gap-2">
            {displaySlots.map((s, index) => {
              if (s.type === "break") return null;

              const time = s.time || "";
              const isFree = s.type === "free";
              const isSelected = selectedSlot === time;

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
            disabled={!selectedSlot || loading || cancelling}
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
    </div>
  );
}

function addMinutes(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h);
  d.setMinutes(m + minutes);
  return d.toTimeString().slice(0, 5);
}

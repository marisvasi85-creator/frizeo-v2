"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SlotPicker from "@/app/components/SlotPicker";
import Calendar from "@/app/components/Calendar";
import VacationNotice from "@/app/components/VacationNotice";
import type { VacationPeriod } from "@/lib/schedule/vacationPeriods";
import RescheduleInfo from "./RescheduleInfo";
import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import { Slot } from "@/types/slots";

export default function RescheduleClient({ booking, token }: any) {
  const router = useRouter();

  const [date, setDate] = useState(booking.date);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const slotsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/services?barberId=${booking.barber_id}`)
      .then((r) => r.json())
      .then((data) => {
        const s = data.services?.find(
          (x: any) => x.id === booking.barber_service_id
        );
        if (s) setDuration(s.duration || 30);
      });
  }, [booking]);

  useEffect(() => {
    const load = async () => {
      setLoadingAvailability(true);

      const from = getTodayInBookingTimezone();
      const to = addDaysToDateString(from, 30);

      const params = new URLSearchParams({
        barberId: booking.barber_id,
        from,
        to,
        serviceId: booking.barber_service_id,
        excludeBookingId: booking.id,
      });

      const res = await fetch(`/api/availability?${params.toString()}`);
      const data = await res.json();

      setAvailableDays(data.availableDays || []);
      setWeeklySchedule(data.weeklySchedule || []);
      setOverrides(data.overrides || []);
      setVacationPeriods(data.vacationPeriods || []);
      setLoadingAvailability(false);
    };

    load();
  }, [booking.barber_id, booking.barber_service_id, booking.id]);

  useEffect(() => {
    if (loadingAvailability) return;

    if (availableDays.length === 0) {
      setDate(null);
      setSelectedSlot(null);
      return;
    }

    if (date && !availableDays.includes(date)) {
      setDate(availableDays[0]);
      setSelectedSlot(null);
    }
  }, [availableDays, loadingAvailability, date]);

  useEffect(() => {
    if (!date) return;

    fetch(
      `/api/slots?barberId=${booking.barber_id}&date=${date}&serviceId=${booking.barber_service_id}&mode=public&excludeBookingId=${booking.id}`,
    )
      .then((r) => r.json())
      .then((data) => {
        const fixed: Slot[] = (data.slots || [])
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

        setSlots(fixed);

        setTimeout(() => {
          slotsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      });
  }, [date, booking]);

  const handleSubmit = async () => {
    if (!selectedSlot) return;

    const endTime = addMinutes(selectedSlot, duration);

    setLoading(true);
    setError("");

    const res = await fetch("/api/bookings/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        new_date: date,
        new_start_time: selectedSlot,
        new_end_time: endTime,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Nu am putut reprograma.");
      setLoading(false);
      return;
    }

    router.push(`/booking/confirmed/${data.bookingId}?rescheduled=1`);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Reprogramează programarea</h2>
        <p className="text-sm text-gray-500">Selectează o nouă dată și oră</p>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <RescheduleInfo booking={booking} />

          <div className="border rounded-2xl p-4 shadow-sm">
            {loadingAvailability ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Se încarcă zilele disponibile...
              </p>
            ) : availableDays.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {vacationPeriods.length > 0
                  ? "Nu sunt date disponibile (concediu sau program complet)."
                  : "Nu mai sunt locuri disponibile în următoarele 30 de zile."}
              </p>
            ) : (
              <>
                {vacationPeriods.length > 0 && (
                  <VacationNotice periods={vacationPeriods} className="mb-4" />
                )}
                <Calendar
                value={date}
                onChange={(d: string) => {
                  setDate(d);
                  setSelectedSlot(null);
                }}
                weeklySchedule={weeklySchedule}
                overrides={overrides}
                availableDays={availableDays}
                enforceAvailableDays
              />
              </>
            )}
          </div>
        </div>

        <div
          ref={slotsRef}
          className="border rounded-2xl p-4 shadow-sm flex flex-col justify-between"
        >
          <div>
            <p className="font-medium mb-4">Alege ora</p>

            {slots.length === 0 ? (
              <p className="text-gray-400 text-sm">
                Nu mai sunt locuri disponibile în această zi. Alege altă dată.
              </p>
            ) : (
              <SlotPicker
                variant="light"
                slots={slots}
                selected={selectedSlot}
                onSelect={setSelectedSlot}
              />
            )}
          </div>

          {error && (
            <p className="text-red-600 text-sm mt-4">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedSlot || loading}
            className={`
              mt-6 w-full p-4 rounded-xl font-medium transition
              ${
                !selectedSlot
                  ? "bg-gray-300 text-gray-500"
                  : "bg-black text-white hover:opacity-90"
              }
            `}
          >
            {loading ? "Se procesează..." : "Confirmă reprogramarea"}
          </button>
        </div>
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

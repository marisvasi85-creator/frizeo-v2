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
import AdminButton from "../../components/AdminButton";
import { useSavedFeedback } from "../../components/useSavedFeedback";
import AdminCard from "../../components/AdminCard";
import { AdminInput, AdminSelect } from "../../components/AdminInput";

export default function AddBookingClient({
  defaultBarberId,
  initialServices,
  role,
  barbers,
}: {
  defaultBarberId: string;
  initialServices: any[];
  role: string | null;
  barbers: any[];
}) {
  const router = useRouter();

  const [date, setDate] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState<string>("");
  const [services, setServices] = useState(initialServices);
  const [selectedBarberId, setSelectedBarberId] = useState(defaultBarberId);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [vacationPeriods, setVacationPeriods] = useState<VacationPeriod[]>([]);

  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [serviceFirstError, setServiceFirstError] = useState("");
  const [saving, setSaving] = useState(false);
  const { saved, markSaved, clearSaved } = useSavedFeedback();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const slotsCache = useRef<Record<string, Slot[]>>({});

  useEffect(() => {
    async function loadAvailability() {
      setLoadingAvailability(true);

      const from = getTodayInBookingTimezone();
      const to = addDaysToDateString(from, 30);
      const params = new URLSearchParams({
        barberId: selectedBarberId,
        from,
        to,
      });

      if (serviceId) {
        params.set("serviceId", serviceId);
      }

      try {
        const res = await fetch(`/api/availability?${params.toString()}`);
        const data = await res.json();

        setAvailableDays(data.availableDays || []);
        setWeeklySchedule(data.weeklySchedule || []);
        setOverrides(data.overrides || []);
        setVacationPeriods(data.vacationPeriods || []);
      } finally {
        setLoadingAvailability(false);
      }
    }

    loadAvailability();
  }, [selectedBarberId, serviceId]);

  useEffect(() => {
    async function loadServices() {
      const res = await fetch(`/api/services?barberId=${selectedBarberId}`);
      const data = await res.json();

      setServices(data.services || []);
      setServiceId("");
      setServiceFirstError("");
      setDate(null);
      setSlots([]);
      setSelectedSlot(null);
      slotsCache.current = {};
    }

    if (role === "owner") {
      loadServices();
    }
  }, [selectedBarberId, role]);

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
      return;
    }

    async function loadSlots() {
      setLoadingSlots(true);

      const res = await fetch(
        `/api/slots?barberId=${selectedBarberId}&date=${date}&serviceId=${serviceId}&mode=admin`,
      );
      const data = await res.json();

      const freeSlots: Slot[] = (data.slots || []).filter(
        (s: Slot) => s.type === "free",
      );

      slotsCache.current[cacheKey] = freeSlots;
      setSlots(freeSlots);
      setSelectedSlot(null);
      setLoadingSlots(false);
    }

    loadSlots();
  }, [date, serviceId, selectedBarberId]);

  function handleServiceChange(value: string) {
    setServiceId(value);
    setServiceFirstError("");
    setDate(null);
    setSelectedSlot(null);
    setSlots([]);
    slotsCache.current = {};
  }

  function handleDateChange(value: string) {
    if (!serviceId) {
      setServiceFirstError(SELECT_SERVICE_FIRST_MESSAGE);
      return;
    }

    setServiceFirstError("");
    setDate(value);
  }

  async function createBooking() {
    if (!selectedSlot || !date || !serviceId) return;

    if (!name.trim()) {
      alert("Introdu numele clientului");
      return;
    }

    if (!phone.trim()) {
      alert("Introdu telefonul");
      return;
    }

    try {
      setSaving(true);
      clearSaved();

      const service = services.find((s) => s.id === serviceId);
      const duration = service?.duration || 30;

      const [y, m, d] = date.split("-").map(Number);
      const [h, min] = selectedSlot.split(":").map(Number);

      const endDate = new Date(y, m - 1, d);
      endDate.setHours(h);
      endDate.setMinutes(min + duration);

      const endTime = endDate.toTimeString().slice(0, 5);

      const holdRes = await fetch("/api/bookings/hold", {
        method: "POST",
        body: JSON.stringify({
          barber_id: selectedBarberId,
          barber_service_id: serviceId,
          date,
          start_time: selectedSlot,
          end_time: endTime,
        }),
      });

      const holdData = await holdRes.json();

      if (!holdRes.ok) {
        throw new Error(holdData.error || "Slot ocupat");
      }

      const createRes = await fetch("/api/bookings/create", {
        method: "POST",
        body: JSON.stringify({
          bookingId: holdData.holdId,
          client_name: name,
          client_phone: phone,
          client_email: email || null,
          client_notes: notes.trim() || null,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        throw new Error(createData.error || "Eroare creare");
      }

      markSaved();
      setSaving(false);
      window.setTimeout(() => router.push("/admin/bookings"), 700);
    } catch (err: any) {
      alert(err.message || "Eroare");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Adaugă programare</h1>

      {role === "owner" && (
        <AdminSelect
          value={selectedBarberId}
          onChange={(e) => setSelectedBarberId(e.target.value)}
        >
          {barbers.map((barber) => (
            <option key={barber.id} value={barber.id}>
              {barber.display_name}
            </option>
          ))}
        </AdminSelect>
      )}

      <div className="space-y-2">
        <p className="text-sm text-white/50 font-medium">1. Alege serviciul</p>
        <AdminSelect value={serviceId} onChange={(e) => handleServiceChange(e.target.value)}>
          <option value="">Alege serviciu</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name} ({s.duration} min)
            </option>
          ))}
        </AdminSelect>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-white/50 font-medium">2. Alege data</p>

        {serviceFirstError && (
          <p className="text-red-500 text-sm">{serviceFirstError}</p>
        )}

        {loadingAvailability ? (
          <p className="text-sm text-white/40">Se încarcă zilele disponibile...</p>
        ) : serviceId && availableDays.length === 0 ? (
          <div className="space-y-3">
            {vacationPeriods.length > 0 && (
              <VacationNotice
                periods={vacationPeriods}
                className="border-amber-500/30 bg-amber-500/10 text-amber-100"
              />
            )}
            <p className="text-sm text-white/50">
              {vacationPeriods.length > 0
                ? "Nu sunt locuri disponibile în următoarele 30 de zile (concediu sau program complet)."
                : "Nu mai sunt locuri disponibile în următoarele 30 de zile pentru acest serviciu."}
            </p>
          </div>
        ) : (
          <>
            {serviceId && vacationPeriods.length > 0 && (
              <VacationNotice
                periods={vacationPeriods}
                className="border-amber-500/30 bg-amber-500/10 text-amber-100"
              />
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
              <p className="text-xs text-white/40">
                Zilele verzi au locuri libere pentru serviciul selectat.
              </p>
            )}
          </>
        )}
      </div>

      {serviceId && date && (loadingSlots || slots.length > 0) && (
        <div className="space-y-2">
          <p className="text-sm text-white/50 font-medium">3. Alege ora</p>
          <SlotPicker
            slots={slots}
            selected={selectedSlot}
            onSelect={setSelectedSlot}
            loading={loadingSlots}
          />
        </div>
      )}

      {serviceId && date && !loadingSlots && slots.length === 0 && (
        <p className="text-sm text-white/50">
          Nu mai sunt locuri disponibile în această zi. Alege altă dată.
        </p>
      )}

      {selectedSlot && (
        <AdminCard padding="sm" className="space-y-3">
          <p className="text-sm text-white/50 font-medium">4. Date client</p>

          <AdminInput
            placeholder="Nume client"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <AdminInput
            placeholder="Telefon"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <AdminInput
            placeholder="Email (opțional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <textarea
            placeholder="Mentiuni (opțional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-[#0F0F10] border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 resize-y min-h-[80px]"
          />

          <AdminButton
            onClick={createBooking}
            disabled={saving || saved}
            loading={saving}
            loadingLabel="Se creează..."
            saved={saved}
            savedLabel="Creat ✔"
            fullWidth
          >
            Creează programare
          </AdminButton>
        </AdminCard>
      )}
    </div>
  );
}

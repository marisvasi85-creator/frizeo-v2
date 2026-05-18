"use client";

import { useEffect, useState } from "react";
import CreateBookingModal from "./CreateBookingModal";

type Service = {
  id: string;
  display_name: string;
  duration: number;
  price: number | null;
};

export default function DayPanelModal({
  date,
  barberId,
  bookings = [],
  overrides = [],
  onClose,
  onRefresh,
}: {
  date: string;
  barberId: string;
  bookings?: any[];
  overrides?: any[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<string>("");
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === serviceId);

  // 🔥 fetch services
  useEffect(() => {
    fetch("/api/services")
      .then((res) => res.json())
      .then((data) => setServices(data.services || []));
  }, []);

  // 🔥 fetch slots când alegi serviciul
  useEffect(() => {
    if (!serviceId || !selectedService) return;

    setLoadingSlots(true);

    fetch(
      `/api/slots?barberId=${barberId}&date=${date}&duration=${selectedService.duration}`
    )
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots || []);
      })
      .finally(() => setLoadingSlots(false));
  }, [serviceId, selectedService, barberId, date]);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-end z-50">
      <div className="w-full max-w-md bg-zinc-900 p-4 space-y-4 h-full overflow-y-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-white">
            {date}
          </h2>

          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* SERVICE SELECT */}
        <select
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="w-full bg-zinc-800 p-3 rounded text-white"
        >
          <option value="">Alege serviciu</option>

          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
              {s.price ? ` - ${s.price} RON` : ""}
            </option>
          ))}
        </select>

        {/* SERVICE INFO */}
        {selectedService && (
          <div className="text-xs text-gray-400">
            Durată: {selectedService.duration} min
            {selectedService.price && ` • ${selectedService.price} RON`}
          </div>
        )}

        {/* SLOTS */}
        {loadingSlots && (
          <div className="text-sm text-gray-400">
            Se încarcă sloturi...
          </div>
        )}

        {!loadingSlots && serviceId && slots.length === 0 && (
          <div className="text-sm text-gray-400">
            Nu există sloturi disponibile
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {slots.map((time) => (
            <button
              key={time}
              onClick={() => setSelectedSlot(time)}
              className="bg-zinc-800 hover:bg-white hover:text-black text-white py-2 rounded"
            >
              {time}
            </button>
          ))}
        </div>

        {/* EXISTING BOOKINGS (optional) */}
        <div className="space-y-2">
          {bookings
            .filter((b: any) => b.date === date)
            .map((b: any) => (
              <div key={b.id} className="bg-zinc-800 p-2 rounded text-sm">
                {b.start_time} - {b.client_name}
              </div>
            ))}
        </div>

        {/* MODAL CREATE */}
        {selectedSlot && (
          <CreateBookingModal
            open={true}
            onClose={() => setSelectedSlot(null)}
            slot={`${date}T${selectedSlot}:00`}
            barberId={barberId}
            onCreated={() => {
              setSelectedSlot(null);
              onRefresh(); // 🔥 refresh real
            }}
          />
        )}
      </div>
    </div>
  );
}
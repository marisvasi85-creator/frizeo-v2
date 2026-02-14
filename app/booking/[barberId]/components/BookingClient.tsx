"use client";

import { useEffect, useState } from "react";
import BookingForm from "./BookingForm";

type Slot = {
  start: string;
  end: string;
};

type Service = {
  id: string;
  name: string;
  duration: number;
  price: number | null;
  featured: boolean;
};

type Props = {
  barberId: string;
  date: string;
  slot: Slot | null;
};

function formatDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function BookingClient({
  barberId,
  date,
  slot,
}: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/services?barberId=${barberId}`
        );
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Nu pot încărca serviciile");
          return;
        }

        setServices(data);

        if (data.length > 0) {
          setServiceId(data[0].id);
        }
      } catch {
        setError("Eroare la încărcare servicii");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [barberId]);

  if (loading) return <p>Se încarcă serviciile…</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div className="space-y-4">
      <h3>Alege serviciul</h3>

      {services.map((s) => (
        <label
          key={s.id}
          className="flex items-center gap-2"
        >
          <input
            type="radio"
            name="service"
            checked={serviceId === s.id}
            onChange={() => setServiceId(s.id)}
          />

          <span>
            {s.name} – {formatDuration(s.duration)}
            {s.price != null && ` / ${s.price} lei`}
            {s.featured && (
              <strong style={{ marginLeft: 6 }}>
                ⭐ Recomandat
              </strong>
            )}
          </span>
        </label>
      ))}

      {slot && serviceId && (
        <BookingForm
          barberId={barberId}
          serviceId={serviceId}
          date={date}
          slot={slot}
        />
      )}
    </div>
  );
}

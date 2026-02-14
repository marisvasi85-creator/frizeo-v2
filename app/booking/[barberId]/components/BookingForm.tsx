"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Slot = {
  start: string;
  end: string;
};

type ClientService = {
  id: string;
  name: string;
  price: number;
  duration: number;
};

type Props = {
  barberId: string;
  serviceId: string;
  date: string;
  slot: Slot;
};

export default function BookingForm({
  barberId,
  serviceId,
  date,
  slot,
}: Props) {
  const router = useRouter();

  const [services, setServices] = useState<ClientService[]>([]);
  const [selectedService, setSelectedService] =
    useState<ClientService | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔹 fetch servicii client
  useEffect(() => {
    fetch(`/api/services?barberId=${barberId}`)
      .then((res) => res.json())
      .then((data) => {
        setServices(data);
        const preset = data.find((s: ClientService) => s.id === serviceId);
        if (preset) setSelectedService(preset);
      });
  }, [barberId, serviceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId,
        serviceId: selectedService.id,
        date,
        start_time: slot.start,
        end_time: slot.end,
        client_name: name,
        client_phone: phone,
        client_email: email || null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Nu s-a putut crea programarea");
      setLoading(false);
      return;
    }

    router.push(`/booking/confirmed/${data.bookingId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 🔥 servicii */}
      <div className="space-y-2">
        {services.map((s) => (
          <button
            type="button"
            key={s.id}
            onClick={() => setSelectedService(s)}
            className={`block w-full text-left border p-2 rounded ${
              selectedService?.id === s.id ? "bg-black text-white" : ""
            }`}
          >
            <div>{s.name}</div>
            <small>
              {s.duration} min · {s.price} lei
            </small>
          </button>
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nume"
        required
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Telefon"
        required
      />
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (opțional)"
      />

      {error && <p className="text-red-500">{error}</p>}

      <button disabled={loading || !selectedService}>
        {loading ? "Se salvează…" : "Confirmă programarea"}
      </button>
    </form>
  );
}

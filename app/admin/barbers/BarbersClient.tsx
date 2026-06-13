"use client";

import { useEffect, useState } from "react";

type Barber = {
  id: string;
  display_name: string;
  phone: string | null;
  active: boolean;
};

export default function BarbersClient({
  currentPlan,
  activeBarbers,
  maxBarbers,
}: {
  currentPlan: string;
  activeBarbers: number;
  maxBarbers: number;
}) {  const [barbers, setBarbers] = useState<Barber[]>([]);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadBarbers() {
    const res = await fetch("/api/barbers");
    const data = await res.json();

    setBarbers(data.barbers || []);
  }

  useEffect(() => {
    loadBarbers();
  }, []);

  async function addBarber() {
  if (!name.trim() || !email.trim()) return;

  setLoading(true);
  setMessage("");

  try {
    const res = await fetch(
      "/api/barbers/invite",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: name,
          email,
          phone,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      setMessage(
        data.error || "Nu s-a putut trimite invitația"
      );
    } else {
      setName("");
      setEmail("");
      setPhone("");

      setMessage(
  "✓ Invitația a fost trimisă. Frizerul va primi un email pentru activarea contului."
);
    }
  } catch {
    setMessage("Eroare server");
  }

  setLoading(false);
}

  async function toggleBarber(
    barberId: string,
    active: boolean
  ) {
    const res = await fetch(
      "/api/barbers/toggle",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          barberId,
          active: !active,
        }),
      }
    );

    if (res.ok) {
      loadBarbers();
    }
  }

  return (
    <div className="space-y-8">

      <div>
        <h1 className="text-2xl font-semibold">
          Frizeri
        </h1>
      <div className="mt-4 bg-[#161618] border border-white/10 rounded-xl p-4">
  <div className="text-sm text-white/60">
    Plan curent
  </div>

  <div className="font-medium mt-1">
    {currentPlan}
  </div>

  <div className="text-sm text-white/60 mt-3">
    Frizeri activi
  </div>

  <div className="font-medium mt-1">
    {activeBarbers} / {maxBarbers}
  </div>

  {activeBarbers >= maxBarbers && (
  <a
    href="/admin/billing"
    className="inline-block mt-4 px-4 py-2 bg-white text-black rounded-lg text-sm"
  >
    Upgrade abonament pentru mai mulți frizeri
  </a>
)}
</div>
        <p className="text-white/60 mt-1">
          Gestionează frizerii salonului.
        </p>
      </div>

      <div className="bg-[#161618] border border-white/10 rounded-xl p-6 space-y-4">

        <h2 className="font-medium">
          Invită frizer
        </h2>

        <input
          placeholder="Nume"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-[#0F0F10] border border-white/10 rounded px-3 py-2"
        />
        <input
  placeholder="Email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  className="w-full bg-[#0F0F10] border border-white/10 rounded px-3 py-2"
/>
        <input
          placeholder="Telefon"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-[#0F0F10] border border-white/10 rounded px-3 py-2"
        />

        <button
          onClick={addBarber}
          disabled={loading}
          className="bg-white text-black px-4 py-2 rounded"
        >
          {loading
            ? "Se salvează..."
            :  "Trimite invitația"}
        </button>

        {message && (
          <div className="text-sm text-white/70">
            {message}
          </div>
        )}

      </div>

      <div className="space-y-3">

        {barbers.length === 0 && (
          <div className="text-white/50">
            Nu există frizeri.
          </div>
        )}

        {barbers.map((barber) => (
          <div
            key={barber.id}
            className="bg-[#161618] border border-white/10 rounded-xl p-4 flex justify-between items-center"
          >
            <div>

              <div className="font-medium">
                {barber.display_name}
              </div>

              <div className="text-sm text-white/60">
                {barber.phone || "Fără telefon"}
              </div>

            </div>

            <div className="flex items-center gap-4">

              <div
                className={
                  barber.active
                    ? "text-green-400 text-sm"
                    : "text-red-400 text-sm"
                }
              >
                {barber.active ? "🟢 Activ" : "🔴 Inactiv"}
              </div>

              <button
                onClick={() =>
                  toggleBarber(
                    barber.id,
                    barber.active
                  )
                }
                className="text-sm text-white/70 hover:text-white"
              >
                {barber.active
                  ? "Dezactivează"
                  : "Activează"}
              </button>

            </div>

          </div>
        ))}

      </div>

    </div>
  );
}
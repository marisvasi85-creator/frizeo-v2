"use client";

import { useState } from "react";

type Props = {
  barberId: string;
  date: string;
  time: string;
  onSuccess: () => void;
};

export default function BookingForm({
  barberId,
  date,
  time,
  onSuccess,
}: Props) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ================= VALIDARE ================= */
  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isValidPhone = (phone: string) =>
    /^[0-9+\s]{9,15}$/.test(phone);

  /* ================= SUBMIT ================= */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientName.trim()) {
      setError("Numele este obligatoriu");
      return;
    }

    if (!isValidEmail(clientEmail)) {
      setError("Email invalid");
      return;
    }

    if (!isValidPhone(clientPhone)) {
      setError("Telefon invalid");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId,
        date,
        time,
        clientName,
        clientEmail,
        clientPhone,
      }),
    });

    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data.error || "Eroare la programare");
      return;
    }

    onSuccess();
  }

  /* ================= UI ================= */
  return (
    <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
      <h3>Detalii programare</h3>

      <p>
        <strong>Data:</strong> {date} <br />
        <strong>Ora:</strong> {time}
      </p>

      <input
        placeholder="Nume"
        value={clientName}
        onChange={(e) => setClientName(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <input
        placeholder="Email"
        value={clientEmail}
        onChange={(e) => setClientEmail(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      <input
        placeholder="Telefon"
        value={clientPhone}
        onChange={(e) => setClientPhone(e.target.value)}
        style={{ width: "100%", marginBottom: 8 }}
      />

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button disabled={loading} style={{ marginTop: 10 }}>
        {loading ? "Se salvează..." : "Confirmă programarea"}
      </button>
    </form>
  );
}

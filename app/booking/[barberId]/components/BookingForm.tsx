"use client";

import { useState } from "react";

type Props = {
  barberId: string;
  date: string;
  time: string;
  onError: () => void;
};

export default function BookingForm({
  barberId,
  date,
  time,
  onError,
}: Props) {

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
  booking_date: date,
  booking_time: time,
  client_name: name,
  client_phone: phone,
  client_email: email,
}),

      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Eroare la booking");
        onError(); // 🔁 reset slot
        setLoading(false);
        return;
      }

      setMessage("Programare confirmată!");
    } catch (err) {
      setMessage("Eroare server");
      onError(); // 🔁 reset slot
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <input
        placeholder="Nume"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <br />
      <input
        placeholder="Telefon"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <br />
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />

      <button onClick={handleSubmit} disabled={loading}>
        {loading ? "Se salvează..." : "Confirmă programarea"}
      </button>

      {message && <p>{message}</p>}
    </div>
  );
}

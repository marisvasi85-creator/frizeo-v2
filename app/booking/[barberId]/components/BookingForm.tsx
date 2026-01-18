"use client";

import { useState } from "react";

export default function BookingForm({
  barberId,
  date,
  time
}: {
  barberId: string;
  date: string;
  time: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const submit = async () => {
    const res = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        barberId,
        date,
        time,
        clientName: name,
        clientPhone: phone
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert("Programare salvată ✔");
  };

  return (
    <div>
      <input placeholder="Nume" value={name} onChange={e => setName(e.target.value)} />
      <input placeholder="Telefon" value={phone} onChange={e => setPhone(e.target.value)} />
      <button onClick={submit}>Confirmă</button>
    </div>
  );
}

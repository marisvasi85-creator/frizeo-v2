"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Service = {
  id: string;
  name: string;
};

export default function BookingPage() {
  const params = useParams();
  const barberId = params.barberId as string;

  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    const { data, error } = await supabase
      .from("services")
      .select("id, name")
      .order("name");

    if (!error && data) {
      setServices(data);
    }
  }

  async function submitBooking() {
    setLoading(true);
    setMessage("");

    const { error } = await supabase.from("bookings").insert({
      barber_id: barberId,
      service_id: serviceId,
      booking_date: date,
      booking_time: time,
      client_name: name,
      client_phone: phone,
      status: "confirmed",
    });

    if (error) {
      console.error(error);
      setMessage("❌ Eroare la programare");
    } else {
      setMessage("✅ Programare creată cu succes");
      setDate("");
      setTime("");
      setName("");
      setPhone("");
      setServiceId("");
    }

    setLoading(false);
  }

  return (
    <div style={{ padding: 24, maxWidth: 400 }}>
      <h1>📅 Programare</h1>

      <label>Serviciu</label>
      <select
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value)}
      >
        <option value="">Alege serviciu</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <br /><br />

      <label>Data</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <br /><br />

      <label>Ora</label>
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />

      <br /><br />

      <label>Nume</label>
      <input value={name} onChange={(e) => setName(e.target.value)} />

      <br /><br />

      <label>Telefon</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value)} />

      <br /><br />

      <button disabled={loading} onClick={submitBooking}>
        {loading ? "Se salvează..." : "Programează"}
      </button>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
    </div>
  );
}

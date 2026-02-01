"use client";

import { useEffect, useState } from "react";

type Slot = {
  start: string;
  end: string;
};

type Booking = {
  id: string;
  barber_id: string;
  date: string;
  start_time: string;
  end_time: string;
};

export default function RescheduleClient({ token }: { token: string }) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ===========================
     1️⃣ Fetch booking by token
     =========================== */
  useEffect(() => {
  async function loadBooking() {
    try {
      console.log("📡 LOAD booking with token:", token);

      const res = await fetch(`/api/bookings/by-token?token=${token}`);
      const data = await res.json();

      console.log("📦 LOAD booking response:", data);

      if (!res.ok) {
        setError(data.error || "Failed to load booking");
        return;
      }

      setBooking(data.booking);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  loadBooking();
}, [token]);

  /* ===========================
     2️⃣ Fetch available slots
     =========================== */
  useEffect(() => {
if (!booking?.barber_id) return;

  const currentBooking = booking; // 🔑 snapshot sigur

  async function loadSlots() {
    try {
      const url = `/api/slots?barberId=${currentBooking.barber_id}&date=${currentBooking.date}`;
      console.log("📡 FETCH SLOTS URL:", url);

      const res = await fetch(url);
      const data = await res.json();

      console.log("🕒 SLOTS RAW RESPONSE:", data);
      console.log("🕒 SLOTS ARRAY:", data.slots);

      if (!res.ok) {
        setError("Failed to load slots");
        return;
      }

      setSlots(data.slots ?? []);
    } catch (err) {
      setError("Slots fetch error");
    }
  }

  loadSlots();
}, [booking]);


  /* ===========================
     3️⃣ Submit reschedule
     =========================== */
  async function submit() {
  if (!selected || !booking) return;

  setLoading(true);

  try {
    const res = await fetch("/api/bookings/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        new_start: selected,
      }),
    });

    const data = await res.json();
    console.log("✅ RESCHEDULE RESPONSE:", data);

    if (!res.ok) {
      alert(data.error || "Reprogramarea a eșuat");
      return;
    }

    // ✅ succes
    alert("Programarea a fost reprogramată cu succes!");

    // 🔁 redirect (alege UNA)
    // window.location.href = "/"; // homepage
    // window.location.href = "/success"; // pagină dedicată
  } catch (err) {
    console.error("RESCHEDULE ERROR:", err);
    alert("Eroare de rețea");
  } finally {
    setLoading(false);
  }
}

  /* ===========================
     UI
     =========================== */
  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!booking) return <div>Booking not found</div>;

  return (
  <div style={{ maxWidth: 480, margin: "0 auto", padding: 20 }}>
    <h1>Reprogramează programarea</h1>

    {/* Loading */}
    {loading && <p>Se încarcă…</p>}

    {/* Error */}
    {!loading && error && (
      <p style={{ color: "red" }}>{error}</p>
    )}

    {/* Booking missing */}
    {!loading && !error && !booking && (
      <p>Programarea nu a fost găsită.</p>
    )}

    {/* Main UI */}
    {!loading && booking && (
      <>
        <p>
          <b>Data:</b> {booking.date}
        </p>
        <p>
          <b>Ora actuală:</b>{" "}
          {booking.start_time} – {booking.end_time}
        </p>

        <hr />

        <h3>Alege un nou slot</h3>

        {slots.length === 0 && (
          <p>Nu există sloturi disponibile pentru această zi.</p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 12,
          }}
        >
          {slots.map((slot) => {
            const value = `${slot.start}:00`;

            const isSelected = selected === value;

            return (
              <button
                key={value}
                onClick={() => setSelected(value)}
                style={{
                  padding: "8px 4px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  cursor: "pointer",
                  background: isSelected ? "#111" : "#fff",
                  color: isSelected ? "#fff" : "#000",
                }}
              >
                {slot.start} – {slot.end}
              </button>
            );
          })}
        </div>

        {selected && (
          <p style={{ marginTop: 12, opacity: 0.8 }}>
            Slot selectat: <b>{selected}</b>
          </p>
        )}

        <button
          onClick={submit}
          disabled={!selected || loading}
          style={{
            marginTop: 20,
            padding: "10px 14px",
            width: "100%",
            borderRadius: 8,
            border: "none",
            background: selected ? "#000" : "#ccc",
            color: "#fff",
            cursor: selected ? "pointer" : "not-allowed",
          }}
        >
          Reprogramează
        </button>
      </>
    )}
  </div>
);

}

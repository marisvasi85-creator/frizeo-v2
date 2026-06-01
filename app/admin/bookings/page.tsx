"use client";

import { useEffect, useState } from "react";
import AdminCalendar from "./components/AdminCalendar";
import EditBookingModal from "./components/EditBookingModal";

function toISO(date: Date) {
  return date.toISOString().split("T")[0];
}

export default function AdminBookingsPage() {
  const today = toISO(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [bookings, setBookings] = useState<any[]>([]);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  // 🔥 LOAD BOOKINGS
  async function loadBookings() {
    const res = await fetch("/api/bookings/list");
    const data = await res.json();
    setBookings(data.bookings || []);
  }

  // 🔥 LOAD AVAILABILITY
  async function loadAvailability() {
    const from = today;
    const to = new Date();
    to.setMonth(to.getMonth() + 1);

    const res = await fetch(
      `/api/availability?barberId=me&from=${from}&to=${to
        .toISOString()
        .split("T")[0]}`
    );

    const data = await res.json();
    setAvailableDays(data.availableDays || []);
  }

  useEffect(() => {
    loadBookings();
    loadAvailability();
  }, []);

  // 🔥 FILTRARE
  const dayBookings = bookings
    .filter((b) => b.date === selectedDate)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="p-6 text-white">

      <h1 className="text-2xl font-semibold mb-6">
        Programări
      </h1>

      <div className="grid md:grid-cols-[320px_1fr] gap-6">

        {/* CALENDAR */}
        <div className="bg-[#0F0F10] p-4 rounded-xl">
          <AdminCalendar
            value={selectedDate}
            onChange={setSelectedDate}
            availableDays={availableDays}
          />
        </div>

        {/* LISTA */}
        <div className="space-y-4">

          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              {new Date(selectedDate).toLocaleDateString("ro-RO", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>

            <a
              href="/admin/bookings/new"
              className="bg-white text-black px-4 py-2 rounded"
            >
              + Adaugă
            </a>
          </div>

          {dayBookings.length === 0 && (
            <div className="text-white/60">
              Nu există programări.
            </div>
          )}

          {dayBookings.map((b) => (
            <div
              key={b.id}
              className="bg-zinc-900 p-4 rounded-xl flex justify-between items-center"
            >
              <div>
                <div className="font-semibold">
                  {b.start_time.slice(0, 5)} -{" "}
                  {b.end_time.slice(0, 5)}
                </div>

                <div className="text-sm text-gray-300">
                  {b.client_name}
                </div>

                <div className="text-xs text-gray-500">
                  {b.client_phone}
                </div>
              </div>

              <div className="flex gap-2">

                <button
                  onClick={() => setEditing(b)}
                  className="px-3 py-1 bg-white text-black rounded text-sm"
                >
                  Edit
                </button>

                <button
                  onClick={async () => {
                    if (confirm("Sigur?")) {
                      await fetch("/api/bookings/cancel", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          token: b.cancel_token,
                        }),
                      });

                      loadBookings();
                    }
                  }}
                  className="px-3 py-1 bg-red-500 text-white rounded text-sm"
                >
                  Anulează
                </button>

              </div>
            </div>
          ))}

        </div>
      </div>

      {/* EDIT */}
      {editing && (
        <EditBookingModal
          booking={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadBookings();
          }}
        />
      )}
    </div>
  );
}
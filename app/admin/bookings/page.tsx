"use client";

import { useEffect, useState } from "react";
import EditBookingModal from "./components/EditBookingModal";

type Booking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_phone: string;
  cancel_token: string;
  reschedule_token: string;
  barber_id: string;
  barber_service_id: string;
  barber_services?: {
    display_name: string;
    duration?: number;
  };
};

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [editing, setEditing] = useState<Booking | null>(null);

  async function loadBookings() {
    const res = await fetch("/api/bookings/list");
    const data = await res.json();
    setBookings(data.bookings || []);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  // 🔥 GROUP BY DATE
  const grouped: Record<string, Booking[]> = {};

  bookings.forEach((b) => {
    if (!grouped[b.date]) grouped[b.date] = [];
    grouped[b.date].push(b);
  });

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="p-6 space-y-6 text-white">

      <h1 className="text-2xl font-semibold">Programări</h1>

      <div className="space-y-6">

        {Object.entries(grouped)
          .sort(([a], [b]) => {
            if (a === today) return -1;
            if (b === today) return 1;

            if (a > today && b > today) return a.localeCompare(b);
            if (a < today && b < today) return b.localeCompare(a);

            if (a > today && b < today) return -1;
            if (a < today && b > today) return 1;

            return 0;
          })
          .map(([date, bookings]) => {
            const isToday = date === today;
            const isPast = date < today;

            return (
              <div key={date} className="space-y-3">

                {/* HEADER ZI */}
                <div
                  className={`flex justify-between items-center p-3 rounded ${
                    isToday
                      ? "bg-blue-600 text-white border border-blue-400 shadow-lg"
                      : isPast
                      ? "bg-zinc-800 opacity-50"
                      : "bg-zinc-800"
                  }`}
                >
                  <div className="font-semibold">
                    {new Date(date).toLocaleDateString("ro-RO", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>

                  <div
                    className={`text-sm px-2 py-1 rounded ${
                      isToday
                        ? "bg-blue-500 text-white"
                        : isPast
                        ? "bg-gray-600 text-gray-300"
                        : "bg-white text-black"
                    }`}
                  >
                    {bookings.length}
                  </div>
                </div>

                {/* BOOKINGS */}
                {bookings
                  .sort((a, b) =>
                    a.start_time.localeCompare(b.start_time)
                  )
                  .map((b) => (
                    <div
                      key={b.id}
                      className="bg-zinc-900 p-4 rounded-xl flex justify-between items-center"
                    >
                      {/* INFO */}
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

                        <div className="text-xs text-gray-400">
                          {b.barber_services?.display_name}
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div className="flex gap-2">

                        {/* EDIT */}
                        <button
                          onClick={() => setEditing(b)}
                          className="px-3 py-1 bg-white text-black rounded text-sm"
                        >
                          Editează
                        </button>

                        {/* ANULARE */}
                        <button
                          onClick={async () => {
                            if (confirm("Sigur vrei să anulezi programarea?")) {
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
            );
          })}
      </div>

      {/* 🔥 EDIT MODAL */}
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
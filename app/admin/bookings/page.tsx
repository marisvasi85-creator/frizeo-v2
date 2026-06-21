"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EditBookingModal from "./components/EditBookingModal";

const inputClass =
  "w-full md:w-auto bg-[#0F0F10] border border-white/10 rounded-lg px-3 py-3 text-sm text-white";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedBarber, setSelectedBarber] = useState("all");

  async function loadBookings() {
    setLoading(true);

    const res = await fetch("/api/bookings/list");
    const data = await res.json();

    setBookings(data.bookings || []);
    setLoading(false);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  const barberNames = [
    "all",
    ...new Set(
      bookings.map((b) => b.barber?.display_name).filter(Boolean)
    ),
  ];

  const filteredBookings =
    selectedBarber === "all"
      ? bookings
      : bookings.filter(
          (b) => b.barber?.display_name === selectedBarber
        );

  return (
    <div className="text-white space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Programări</h1>

        <select
          value={selectedBarber}
          onChange={(e) => setSelectedBarber(e.target.value)}
          className={inputClass}
        >
          {barberNames.map((name) => (
            <option key={name} value={name}>
              {name === "all" ? "Toți frizerii" : name}
            </option>
          ))}
        </select>

        <Link
          href="/admin/bookings/new"
          className="w-full md:w-auto bg-white text-black px-4 py-3 rounded-lg font-medium text-center"
        >
          + Adaugă programare
        </Link>
      </div>

      {loading ? (
        <div className="text-white/60">Se încarcă...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-12 text-white/60">
          Nu există programări.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((booking) => (
            <button
              key={booking.id}
              onClick={() => setEditing(booking)}
              className="w-full bg-[#161618] border border-white/10 rounded-xl p-4 text-left hover:border-white/20 transition"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">{booking.client_name}</div>
                  <div className="text-sm text-white/60">
                    {booking.client_phone}
                  </div>
                </div>

                {booking.barber?.display_name && (
                  <div className="text-xs text-blue-400 mt-1">
                    👤 {booking.barber.display_name}
                  </div>
                )}

                <div className="text-right">
                  <div className="font-medium">
                    {booking.barber_services?.display_name ||
                      booking.barber_services?.name ||
                      "Serviciu"}
                  </div>
                  <div className="text-sm text-white/60">{booking.date}</div>
                  <div className="text-sm text-white/60">
                    {booking.start_time?.slice(0, 5)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

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

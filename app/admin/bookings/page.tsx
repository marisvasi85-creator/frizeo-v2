"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EditBookingModal from "./components/EditBookingModal";

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

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

  return (
    <div className="p-6 text-white space-y-6">

      <div className="flex items-center justify-between">

        <h1 className="text-2xl font-semibold">
          Programări
        </h1>

        <Link
          href="/admin/bookings/new"
          className="bg-white text-black px-4 py-2 rounded-xl font-medium"
        >
          + Adaugă programare
        </Link>

      </div>

      {loading ? (
        <div className="text-zinc-400">
          Se încarcă...
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-zinc-400">
          Nu există programări.
        </div>
      ) : (
        <div className="space-y-3">

          {bookings.map((booking) => (
            <button
              key={booking.id}
              onClick={() => setEditing(booking)}
              className="
                w-full
                bg-zinc-900
                border border-zinc-800
                rounded-xl
                p-4
                text-left
                hover:border-zinc-600
                transition
              "
            >
              <div className="flex justify-between items-center">

                <div>
                  <div className="font-semibold">
                    {booking.client_name}
                  </div>

                  <div className="text-sm text-zinc-400">
                    {booking.client_phone}
                  </div>
                </div>

                <div className="text-right">

                  <div className="font-medium">
                    {booking.barber_services?.display_name ||
                      booking.barber_services?.name ||
                      "Serviciu"}
                  </div>

                  <div className="text-sm text-zinc-400">
                    {booking.date}
                  </div>

                  <div className="text-sm text-zinc-400">
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
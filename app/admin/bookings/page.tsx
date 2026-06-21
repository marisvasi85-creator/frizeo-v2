"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import EditBookingModal from "./components/EditBookingModal";

const inputClass =
  "w-full md:w-auto bg-[#0F0F10] border border-white/10 rounded-lg px-3 py-3 text-sm text-white";

function formatCancelConfirm(booking: any) {
  const time = booking.start_time?.slice(0, 5) || "";
  return `Anulezi programarea lui ${booking.client_name} din ${booking.date} la ${time}? Clientul va primi notificare dacă e activată.`;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedBarber, setSelectedBarber] = useState("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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

  async function cancelBooking(booking: any) {
    const ok = confirm(formatCancelConfirm(booking));
    if (!ok) return;

    setCancellingId(booking.id);

    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Nu s-a putut anula programarea");
      setCancellingId(null);
      return;
    }

    setCancellingId(null);
    await loadBookings();
  }

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
            <div
              key={booking.id}
              className="bg-[#161618] border border-white/10 rounded-xl p-4 flex items-stretch gap-3 hover:border-white/20 transition"
            >
              <button
                type="button"
                onClick={() => setEditing(booking)}
                className="flex-1 text-left min-w-0"
              >
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <div className="font-semibold">{booking.client_name}</div>
                    <div className="text-sm text-white/60">
                      {booking.client_phone}
                    </div>
                    {booking.barber?.display_name && (
                      <div className="text-xs text-blue-400 mt-1">
                        👤 {booking.barber.display_name}
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
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

              <button
                type="button"
                onClick={() => cancelBooking(booking)}
                disabled={cancellingId === booking.id}
                className="shrink-0 self-center px-3 py-2 text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg hover:bg-red-500/10 disabled:opacity-50"
              >
                {cancellingId === booking.id ? "..." : "Anulează"}
              </button>
            </div>
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
          onCancelled={() => {
            setEditing(null);
            loadBookings();
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import EditBookingModal from "./components/EditBookingModal";
import AdminPageHeader from "../components/AdminPageHeader";
import AdminCard from "../components/AdminCard";
import AdminButton from "../components/AdminButton";
import EmptyState from "../components/EmptyState";
import { AdminSelect } from "../components/AdminInput";

function formatCancelConfirm(booking: any) {
  const time = booking.start_time?.slice(0, 5) || "";
  return `Anulezi programarea lui ${booking.client_name} din ${booking.date} la ${time}? Clientul va primi notificare dacă e activată.`;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedBarber, setSelectedBarber] = useState("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadBookings() {
    setLoading(true);
    setLoadError("");

    const res = await fetch("/api/bookings/list");
    const data = await res.json();

    if (!res.ok) {
      setLoadError(data.error || "Nu am putut încărca programările.");
      setBookings([]);
      setLoading(false);
      return;
    }

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
      <AdminPageHeader title="Programări">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <AdminSelect
            value={selectedBarber}
            onChange={(e) => setSelectedBarber(e.target.value)}
            className="md:w-auto py-3 px-3 text-sm"
          >
            {barberNames.map((name) => (
              <option key={name} value={name}>
                {name === "all" ? "Toți frizerii" : name}
              </option>
            ))}
          </AdminSelect>

          <AdminButton href="/admin/bookings/new" className="py-3 px-4">
            + Adaugă programare
          </AdminButton>
        </div>
      </AdminPageHeader>

      {loading ? (
        <div className="text-white/60">Se încarcă...</div>
      ) : loadError ? (
        <EmptyState>{loadError}</EmptyState>
      ) : filteredBookings.length === 0 ? (
        <EmptyState>Nu există programări.</EmptyState>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((booking) => (
            <AdminCard
              key={booking.id}
              padding="sm"
              hoverable
              className="flex items-stretch gap-3"
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

              <AdminButton
                variant="danger"
                size="sm"
                onClick={() => cancelBooking(booking)}
                disabled={cancellingId === booking.id}
                className="shrink-0 self-center"
              >
                {cancellingId === booking.id ? "..." : "Anulează"}
              </AdminButton>
            </AdminCard>
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

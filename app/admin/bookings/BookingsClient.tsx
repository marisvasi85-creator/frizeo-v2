"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import BookingsGroupedList from "./components/BookingsGroupedList";
import AdminPageHeader from "../components/AdminPageHeader";
import AdminButton from "../components/AdminButton";
import EmptyState from "../components/EmptyState";
import { AdminSelect } from "../components/AdminInput";
import {
  groupBookingsForList,
  type BookingRow,
  type GroupMode,
} from "@/lib/bookings/groupBookingsForList";
import { cn } from "../components/cn";

const EditBookingModal = dynamic(() => import("./components/EditBookingModal"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center text-white/70 text-sm">
      Se încarcă…
    </div>
  ),
});

const GROUP_MODES: { value: GroupMode; label: string }[] = [
  { value: "day", label: "Zile" },
  { value: "week", label: "Săptămâni" },
  { value: "month", label: "Luni" },
];

type BarberOption = {
  id: string;
  display_name: string;
  active?: boolean;
};

export default function BookingsClient({
  initialBookings,
  initialBarbers,
  initialError = "",
}: {
  initialBookings: BookingRow[];
  initialBarbers: BarberOption[];
  initialError?: string;
}) {
  const [bookings, setBookings] = useState<BookingRow[]>(initialBookings);
  const [barbers] = useState<BarberOption[]>(initialBarbers);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(initialError);
  const [editing, setEditing] = useState<BookingRow | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("day");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setLoadError("");

    const [bookingsRes, barbersRes] = await Promise.all([
      fetch("/api/bookings/list"),
      fetch("/api/barbers"),
    ]);

    const bookingsData = await bookingsRes.json();
    const barbersData = await barbersRes.json();

    if (!bookingsRes.ok) {
      setLoadError(bookingsData.error || "Nu am putut încărca programările.");
      setBookings([]);
      setLoading(false);
      return;
    }

    setBookings(bookingsData.bookings || []);
    if (Array.isArray(barbersData.barbers)) {
      // keep filter options fresh after mutations if needed
    }
    setLoading(false);
  }

  async function cancelBooking(booking: BookingRow) {
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
    await loadData();
  }

  const filteredBookings =
    selectedBarberId === "all"
      ? bookings
      : bookings.filter((b) => b.barber_id === selectedBarberId);

  const timeline = useMemo(
    () => groupBookingsForList(filteredBookings, groupMode),
    [filteredBookings, groupMode],
  );

  return (
    <div className="text-white space-y-6">
      <AdminPageHeader title="Programări">
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <AdminSelect
            value={selectedBarberId}
            onChange={(e) => setSelectedBarberId(e.target.value)}
            className="md:w-auto py-3 px-3 text-sm"
          >
            <option value="all">Toți frizerii</option>
            {barbers.map((barber) => (
              <option key={barber.id} value={barber.id}>
                {barber.display_name}
                {!barber.active ? " (inactiv)" : ""}
              </option>
            ))}
          </AdminSelect>

          <AdminButton href="/admin/bookings/new" className="py-3 px-4">
            + Adaugă programare
          </AdminButton>
        </div>
      </AdminPageHeader>

      {!loading && !loadError && filteredBookings.length > 0 && (
        <div className="inline-flex rounded-lg border border-white/10 p-1 bg-[#0F0F10]">
          {GROUP_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => setGroupMode(mode.value)}
              className={cn(
                "px-4 py-2 text-sm rounded-md transition",
                groupMode === mode.value
                  ? "bg-white text-black font-medium"
                  : "text-white/60 hover:text-white",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-white/60">Se încarcă...</div>
      ) : loadError ? (
        <EmptyState>{loadError}</EmptyState>
      ) : filteredBookings.length === 0 ? (
        <EmptyState>Nu există programări.</EmptyState>
      ) : (
        <BookingsGroupedList
          upcoming={timeline.upcoming}
          past={timeline.past}
          onEdit={setEditing}
          onCancel={cancelBooking}
          cancellingId={cancellingId}
        />
      )}

      {editing && (
        <EditBookingModal
          booking={editing as never}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void loadData();
          }}
          onCancelled={() => {
            setEditing(null);
            void loadData();
          }}
        />
      )}
    </div>
  );
}

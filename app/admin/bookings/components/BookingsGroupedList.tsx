"use client";

import AdminCard from "../../components/AdminCard";
import AdminButton from "../../components/AdminButton";
import {
  type BookingGroup,
  type BookingRow,
  countBookings,
} from "@/lib/bookings/groupBookingsForList";
import { getServiceDisplayName } from "@/lib/bookings/getServiceDisplayName";

type Props = {
  upcoming: BookingGroup[];
  past: BookingGroup[];
  onEdit: (booking: BookingRow) => void;
  onCancel: (booking: BookingRow) => void;
  cancellingId: string | null;
};

function formatCancelConfirm(booking: BookingRow) {
  const time = booking.start_time?.slice(0, 5) || "";
  return `Anulezi programarea lui ${booking.client_name} din ${booking.date} la ${time}? Clientul va primi notificare dacă e activată.`;
}

function BookingCard({
  booking,
  muted,
  onEdit,
  onCancel,
  cancellingId,
}: {
  booking: BookingRow;
  muted?: boolean;
  onEdit: (booking: BookingRow) => void;
  onCancel: (booking: BookingRow) => void;
  cancellingId: string | null;
}) {
  return (
    <AdminCard
      padding="sm"
      hoverable={!muted}
      className={`flex items-stretch gap-3 ${muted ? "opacity-70 border-white/5" : ""}`}
    >
      <button
        type="button"
        onClick={() => onEdit(booking)}
        className="flex-1 text-left min-w-0"
      >
        <div className="flex justify-between items-center gap-3">
          <div>
            <div className={`font-semibold ${muted ? "text-white/80" : ""}`}>
              {booking.client_name}
            </div>
            <div className="text-sm text-white/60">{booking.client_phone}</div>
            {booking.barber?.display_name && (
              <div className="text-xs text-blue-400 mt-1">
                👤 {booking.barber.display_name}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            <div className="font-medium">
              {getServiceDisplayName(booking.barber_services)}
            </div>
            <div className="text-sm text-white/60">
              {booking.start_time?.slice(0, 5)}
              {booking.end_time ? ` – ${booking.end_time.slice(0, 5)}` : ""}
            </div>
            {muted && (
              <div className="text-xs text-white/40 mt-1">{booking.date}</div>
            )}
          </div>
        </div>
      </button>

      {!muted && (
        <AdminButton
          variant="danger"
          size="sm"
          onClick={() => {
            if (confirm(formatCancelConfirm(booking))) {
              onCancel(booking);
            }
          }}
          disabled={cancellingId === booking.id}
          className="shrink-0 self-center"
        >
          {cancellingId === booking.id ? "..." : "Anulează"}
        </AdminButton>
      )}
    </AdminCard>
  );
}

function GroupBlock({
  group,
  muted,
  onEdit,
  onCancel,
  cancellingId,
}: {
  group: BookingGroup;
  muted?: boolean;
  onEdit: (booking: BookingRow) => void;
  onCancel: (booking: BookingRow) => void;
  cancellingId: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3
          className={`text-sm font-semibold capitalize ${
            group.highlight
              ? "text-emerald-300"
              : muted
                ? "text-white/50"
                : "text-white/80"
          }`}
        >
          {group.label}
        </h3>
        <span className="text-xs text-white/40 shrink-0">
          {group.count}{" "}
          {group.count === 1 ? "programare" : "programări"}
        </span>
      </div>

      <div className="space-y-2">
        {group.bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            muted={muted}
            onEdit={onEdit}
            onCancel={onCancel}
            cancellingId={cancellingId}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineSection({
  title,
  groups,
  emptyLabel,
  muted,
  onEdit,
  onCancel,
  cancellingId,
}: {
  title: string;
  groups: BookingGroup[];
  emptyLabel: string;
  muted?: boolean;
  onEdit: (booking: BookingRow) => void;
  onCancel: (booking: BookingRow) => void;
  cancellingId: string | null;
}) {
  const total = countBookings(groups);

  return (
    <section className="space-y-4">
      <div
        className={`flex items-center gap-3 ${
          muted ? "border-t border-white/10 pt-6" : ""
        }`}
      >
        <h2
          className={`text-lg font-semibold ${
            muted ? "text-white/50" : "text-white"
          }`}
        >
          {title}
        </h2>
        <span
          className={`text-sm ${muted ? "text-white/30" : "text-white/40"}`}
        >
          {total}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className={`text-sm ${muted ? "text-white/30" : "text-white/50"}`}>
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <GroupBlock
              key={group.key}
              group={group}
              muted={muted}
              onEdit={onEdit}
              onCancel={onCancel}
              cancellingId={cancellingId}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function BookingsGroupedList({
  upcoming,
  past,
  onEdit,
  onCancel,
  cancellingId,
}: Props) {
  return (
    <div className="space-y-8">
      <TimelineSection
        title="Urmează"
        groups={upcoming}
        emptyLabel="Nu ai programări viitoare."
        onEdit={onEdit}
        onCancel={onCancel}
        cancellingId={cancellingId}
      />

      <TimelineSection
        title="Trecute"
        groups={past}
        emptyLabel="Nu există programări trecute."
        muted
        onEdit={onEdit}
        onCancel={onCancel}
        cancellingId={cancellingId}
      />
    </div>
  );
}

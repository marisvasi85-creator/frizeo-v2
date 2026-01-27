"use client";

type Booking = {
  id: string;
  booking_time: string;
  client_name: string;
  status: string;
};

type Props = {
  booking: Booking;
  onClose: () => void;
  onCancelled: () => void;
};

export default function BookingDetailsModal({
  booking,
  onClose,
  onCancelled,
}: Props) {
  async function cancelBooking() {
    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    if (res.ok) {
      onCancelled();
    } else {
      alert("Eroare la anulare");
    }
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <h3>Programare</h3>

        <p>
          <strong>Client:</strong> {booking.client_name}
        </p>
        <p>
          <strong>Ora:</strong> {booking.booking_time}
        </p>
        <p>
          <strong>Status:</strong> {booking.status}
        </p>

        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button
            onClick={cancelBooking}
            style={{
              background: "#aa0000",
              color: "white",
              padding: "8px 12px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Anulează programarea
          </button>

          <button
            onClick={onClose}
            style={{
              padding: "8px 12px",
              cursor: "pointer",
            }}
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: "#111",
  color: "white",
  padding: 20,
  borderRadius: 8,
  width: 320,
};

"use client";

type Booking = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_phone: string;
  client_email?: string;
  status: string;
};

export default function BookingDetailsModal({
  booking,
  onClose,
  onCancelled,
}: {
  booking: Booking;
  onClose: () => void;
  onCancelled: () => void;
}) {
  async function cancelBooking() {
    if (!confirm("Sigur vrei să anulezi această programare?")) return;

    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: booking.id,
        cancelledBy: "barber",
      }),
    });

    if (!res.ok) {
      alert("Eroare la anulare");
      return;
    }

    onCancelled();
    onClose();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 8,
          width: 360,
        }}
      >
        <h3>Detalii programare</h3>

        <p>
          <strong>Data:</strong> {booking.date}
        </p>
        <p>
          <strong>Ora:</strong>{" "}
          {booking.start_time} – {booking.end_time}
        </p>
        <p>
          <strong>Client:</strong> {booking.client_name}
        </p>
        <p>
          <strong>Telefon:</strong> {booking.client_phone}
        </p>
        {booking.client_email && (
          <p>
            <strong>Email:</strong> {booking.client_email}
          </p>
        )}

        <p>
          <strong>Status:</strong> {booking.status}
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 16,
          }}
        >
          {booking.status !== "cancelled" && (
            <button onClick={cancelBooking}>
              Anulează
            </button>
          )}
          <button onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}

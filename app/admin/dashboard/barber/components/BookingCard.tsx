type Props = {
  booking: any;
  onCancelled: () => void;
};

export default function BookingCard({ booking, onCancelled }: Props) {
  const isCancelled = booking.status === "cancelled";

  const handleCancel = async () => {
    if (isCancelled) return;

    const ok = confirm(
      `Sigur vrei să anulezi programarea de la ${booking.booking_time}?`
    );
    if (!ok) return;

    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: booking.cancel_token,
        cancelled_by: "barber",
      }),
    });

    if (res.ok) {
      onCancelled();
    } else {
      alert("Eroare la anulare");
    }
  };

  return (
    <div
      style={{
        border: "1px solid #333",
        padding: 12,
        marginBottom: 8,
        borderRadius: 6,
        opacity: isCancelled ? 0.6 : 1,
        background: isCancelled ? "#1a1a1a" : "transparent",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <strong>{booking.booking_time}</strong> – {booking.client_name}
        </div>

        <span
          style={{
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 12,
            background: isCancelled ? "#922" : "#294",
            color: "#fff",
          }}
        >
          {isCancelled ? "Anulată" : "Confirmată"}
        </span>
      </div>

      <div style={{ fontSize: 14, opacity: 0.8 }}>
        {booking.client_phone}
      </div>

      <button
        onClick={handleCancel}
        disabled={isCancelled}
        style={{
          marginTop: 8,
          color: isCancelled ? "#777" : "red",
          cursor: isCancelled ? "not-allowed" : "pointer",
        }}
      >
        Anulează
      </button>
    </div>
  );
}

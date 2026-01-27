"use client";

type Booking = {
  id: string;
  booking_time: string;
  client_name: string;
  client_phone: string;
  status: string;
};

type Props = {
  booking: Booking;
  onClose: () => void;
  onCancelled: () => void;
};

export default function SlotActionModal({
  booking,
  onClose,
  onCancelled,
}: Props) {
  const cancelBooking = async () => {
    const res = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: booking.id }),
    });

    if (res.ok) {
      onCancelled();
      onClose();
    } else {
      alert("Eroare la anulare");
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Programare {booking.booking_time}</h3>

        <p>
          <strong>Client:</strong> {booking.client_name}
        </p>
        <p>
          <strong>Telefon:</strong> {booking.client_phone}
        </p>
        <p>
          <strong>Status:</strong> {booking.status}
        </p>

        <div className="modal-actions">
          <button className="btn danger" onClick={cancelBooking}>
            Anulează programarea
          </button>
          <button className="btn" onClick={onClose}>
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}

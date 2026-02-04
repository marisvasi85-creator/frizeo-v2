import BookingConfirmed from "./BookingConfirmedClient";

export default function Page({ params }: { params: { bookingId: string } }) {
  return <BookingConfirmed bookingId={params.bookingId} />;
}

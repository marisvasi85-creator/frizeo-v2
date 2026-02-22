import BookingConfirmedClient from "./BookingConfirmedClient";

type PageProps = {
  params: Promise<{
    bookingId: string;
  }>;
};

export default async function BookingConfirmedPage({ params }: PageProps) {
  const { bookingId } = await params;

  return <BookingConfirmedClient bookingId={bookingId} />;
}

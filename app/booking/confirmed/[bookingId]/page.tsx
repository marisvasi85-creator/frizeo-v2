import BookingConfirmedClient from "./BookingConfirmedClient";

type Props = {
  params: Promise<{
    bookingId: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { bookingId } = await params;

  return <BookingConfirmedClient bookingId={bookingId} />;
}
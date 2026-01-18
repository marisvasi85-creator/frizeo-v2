import BookingClient from "./components/BookingClient";

type Props = {
  params: Promise<{
    barberId: string;
  }>;
};

export default async function Page({ params }: Props) {
  const { barberId } = await params;

  return <BookingClient barberId={barberId} />;
}

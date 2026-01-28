import BookingClient from "./components/BookingClient";

type Props = {
  params: Promise<{
    barberId: string;
  }>;
};

export default async function BookingPage({ params }: Props) {
  const { barberId } = await params;

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: 16 }}>
      <h1>Programează-te</h1>
      <BookingClient barberId={barberId} />
    </div>
  );
}

import BookingClient from "./components/BookingClient";

export default async function Page({
  params,
}: {
  params: Promise<{ barberId: string }>;
}) {
  // 🔥 IMPORTANT
  const { barberId } = await params;

  if (!barberId) {
    return <div>Barber invalid</div>;
  }

  const res = await fetch(
    `http://localhost:3000/api/barber/profile?barberId=${barberId}`,
    { cache: "no-store" }
  );

  const data = await res.json();

  return (
    <BookingClient
      barberId={barberId}
      barberName={data?.profile?.display_name || "Frizer"}
    />
  );
}
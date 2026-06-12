import BookingClient from "./components/BookingClient";

export default async function Page({
  params,
}: {
  params: Promise<{ barberId: string }>;
}) {
  const { barberId } = await params;

  if (!barberId) {
    return <div>Barber invalid</div>;
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(
    `${baseUrl}/api/barber/profile?barberId=${barberId}`,
    {
      cache: "no-store",
    }
  );

  const data = await res.json();

  return (
    <BookingClient
      barberId={barberId}
      barberName={
        data?.profile?.display_name || "Frizer"
      }
    />
  );
}
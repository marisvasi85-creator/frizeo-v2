import RescheduleClient from "./components/RescheduleClient";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ReschedulePage({ params }: Props) {
  const { token } = await params;

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: 16 }}>
      <h1>Reprogramează-te</h1>
      <RescheduleClient token={token} />
    </div>
  );
}

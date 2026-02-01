import RescheduleClient from "./RescheduleClient";

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <RescheduleClient token={token} />;
}

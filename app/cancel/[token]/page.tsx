import CancelClient from "./CancelClient";

export default function Page({
  params,
}: {
  params: { token: string };
}) {
  return <CancelClient token={params.token} />;
}
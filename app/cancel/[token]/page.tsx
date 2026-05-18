import CancelClient from "./CancelClient";

export default function Page({
  params,
}: {
  params: { token: string };
}) {
   console.log("TOKEN:", params);
  const token = params?.token;

  if (!token) {
    return <div className="p-6 text-center">Missing token</div>;
  }

  return <CancelClient token={token} />;
}
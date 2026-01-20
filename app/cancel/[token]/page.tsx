import CancelClient from "./CancelClient";

type Props = {
  params: Promise<{ token: string }>;
};

export default async function CancelPage({ params }: Props) {
  const { token } = await params;

  if (!token) {
    return <p>Token lipsă</p>;
  }

  return <CancelClient token={token} />;
}

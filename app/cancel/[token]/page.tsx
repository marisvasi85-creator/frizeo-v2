import CancelClient from "./CancelClient";

type Props = {
  params: Promise<{
    token: string;
  }>;
};

export default async function CancelPage({ params }: Props) {
  const { token } = await params;

  return <CancelClient token={token} />;
}

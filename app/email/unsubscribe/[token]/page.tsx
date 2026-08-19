import UnsubscribeClient from "./UnsubscribeClient";

type Params = Promise<{ token: string }>;

export const metadata = {
  title: "Dezabonare | Frizeo Email",
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({ params }: { params: Params }) {
  const { token } = await params;

  return (
    <div className="min-h-screen bg-frz-fog text-frz-ink flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-frz-line bg-frz-card p-8 shadow-xl">
        <p className="text-xs uppercase tracking-[0.18em] text-frz-muted mb-3">
          Frizeo Email
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mb-2">
          Dezabonare
        </h1>
        <p className="text-sm text-frz-muted mb-6">
          Confirmă că nu mai vrei să primești emailuri de marketing de la
          Frizeo. Emailurile tranzacționale (programări, cont) nu sunt afectate.
        </p>
        <UnsubscribeClient token={token} />
      </div>
    </div>
  );
}

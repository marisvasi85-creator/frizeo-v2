"use client";

import { useState } from "react";
import type { QuickApprovalViewState } from "@/lib/barber-access/quickApprovalToken";

type DisplayState = QuickApprovalViewState | "approved";

const COPY: Record<DisplayState, { title: string; message: string }> = {
  pending: {
    title: "Cerere nouă de acces",
    message: "Confirmă explicit dacă vrei să accepți acest client.",
  },
  approved: {
    title: "Client acceptat",
    message: "Clientul se poate programa acum la tine.",
  },
  already_approved: {
    title: "Client deja acceptat",
    message: "Acest client are deja acces la programările tale.",
  },
  rejected: {
    title: "Cererea nu mai este în așteptare",
    message: "Poți administra clientul din Frizeo.",
  },
  blocked: {
    title: "Cererea nu mai poate fi acceptată din acest link.",
    message: "Poți administra clientul din Frizeo.",
  },
  unavailable: {
    title: "Linkul nu mai este disponibil",
    message: "Deschide Frizeo pentru a verifica cererile în așteptare.",
  },
};

export default function QuickApprovalCard({
  initialState,
  token,
  dashboardUrl,
  barberName,
  clientName,
  clientPhone,
  clientEmail,
  referral,
  message,
}: {
  initialState: QuickApprovalViewState;
  token: string;
  dashboardUrl: string;
  barberName: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  referral: string | null;
  message: string | null;
}) {
  const [state, setState] = useState<DisplayState>(initialState);
  const [copy, setCopy] = useState(COPY[initialState]);
  const [loading, setLoading] = useState(false);
  const showDetails = initialState === "pending" && state === "pending";

  async function acceptClient() {
    if (state !== "pending" || loading) return;
    setLoading(true);

    try {
      const response = await fetch("/api/public/barber-access/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      const nextState: DisplayState =
        data.outcome === "approved"
          ? "approved"
          : data.outcome === "already_approved"
            ? "already_approved"
            : data.outcome === "rejected"
              ? "rejected"
              : data.outcome === "blocked"
                ? "blocked"
                : "unavailable";

      setState(nextState);
      setCopy({
        title: typeof data.title === "string" ? data.title : COPY[nextState].title,
        message:
          typeof data.message === "string"
            ? data.message
            : COPY[nextState].message,
      });
    } catch {
      setState("unavailable");
      setCopy(COPY.unavailable);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-12 sm:px-6">
      <section className="w-full rounded-2xl border border-frz-line bg-frz-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-frz-muted">
          Frizeo
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="mt-3 text-frz-muted">{copy.message}</p>

        {showDetails && (
          <div className="mt-6 rounded-xl border border-frz-line bg-frz-fog p-4">
            <p className="text-lg font-semibold">
              {clientName || "Un client"} vrea să se programeze la tine.
            </p>
            {barberName && (
              <p className="mt-1 text-sm text-frz-muted">Pentru {barberName}</p>
            )}
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {clientPhone && <Detail label="Telefon" value={clientPhone} />}
              {clientEmail && <Detail label="Email" value={clientEmail} />}
              {referral && <Detail label="Recomandat de" value={referral} />}
              {message && <Detail label="Mesaj" value={message} wide />}
            </dl>
          </div>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          {state === "pending" && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void acceptClient()}
              className="rounded-xl bg-frz-ink px-5 py-3 font-semibold text-frz-ink-contrast transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Se acceptă..." : "Acceptă clientul"}
            </button>
          )}
          <a
            href={dashboardUrl}
            className="rounded-xl border border-frz-line bg-frz-card px-5 py-3 text-center font-semibold transition hover:bg-frz-fog"
          >
            Deschide în Frizeo
          </a>
        </div>

        {state === "pending" && (
          <p className="mt-5 text-xs leading-relaxed text-frz-muted">
            Pagina nu aprobă automat clientul. Doar apăsarea butonului de mai
            sus trimite decizia către server.
          </p>
        )}
      </section>
    </main>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs uppercase tracking-wide text-frz-muted">{label}</dt>
      <dd className="mt-1 break-words whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

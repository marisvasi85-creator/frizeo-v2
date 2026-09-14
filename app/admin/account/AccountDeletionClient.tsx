"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import AdminModal from "../components/AdminModal";
import {
  ACCOUNT_DELETION_REASON_LABELS,
  ACCOUNT_DELETION_REASONS,
  formatDeletionDateRo,
  type AccountDeletionReason,
} from "@/lib/account-deletion/constants";

type ActiveRequest = {
  id: string;
  status: string;
  scheduled_for: string;
  requested_at: string;
};

export default function AccountDeletionClient({
  email,
  activeRequest,
}: {
  email: string;
  activeRequest: ActiveRequest | null;
}) {
  const router = useRouter();
  const [request, setRequest] = useState(activeRequest);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"warn" | "confirm">("warn");
  const [reason, setReason] = useState<AccountDeletionReason | "">("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [password, setPassword] = useState("");
  const [typedEmail, setTypedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const scheduledLabel = useMemo(
    () => (request ? formatDeletionDateRo(request.scheduled_for) : ""),
    [request],
  );

  function resetModal() {
    setOpen(false);
    setStep("warn");
    setPassword("");
    setTypedEmail("");
    setError("");
  }

  async function submitRequest() {
    setError("");
    if (typedEmail.trim().toLowerCase() !== email.trim().toLowerCase()) {
      setError("Tastează adresa de email a contului pentru a confirma.");
      return;
    }
    if (!password) {
      setError("Parola este obligatorie.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account-deletion/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          password,
          reason: reason || undefined,
          reasonDetails: reason === "other" ? reasonDetails : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Nu am putut programa ștergerea.");
        return;
      }
      setRequest(data.request);
      resetModal();
      router.refresh();
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelDeletion() {
    setCancelLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account-deletion/cancel", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Nu am putut anula solicitarea.");
        return;
      }
      setRequest(null);
      router.refresh();
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setCancelLoading(false);
    }
  }

  if (request?.status === "pending") {
    return (
      <AdminCard className="border-red-200 bg-red-50/40 space-y-4">
        <h2 className="text-lg font-semibold text-red-800">Ștergere cont</h2>
        <p className="text-sm text-frz-ink">
          Cont programat pentru ștergere la <strong>{scheduledLabel}</strong>
        </p>
        <p className="text-sm text-frz-muted">
          Contul rămâne funcțional până la această dată. Poți anula oricând
          înainte.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <AdminButton
          variant="secondary"
          onClick={cancelDeletion}
          loading={cancelLoading}
          loadingLabel="Se anulează..."
        >
          Anulează ștergerea
        </AdminButton>
      </AdminCard>
    );
  }

  return (
    <>
      <AdminCard className="border-red-200 space-y-4">
        <h2 className="text-lg font-semibold text-red-800">Ștergere cont</h2>
        <p className="text-sm text-frz-muted">
          Aceasta este zona de risc. Ștergerea contului este ireversibilă după
          perioada de 7 zile. Salonul și programările celorlalți membri nu sunt
          șterse automat.
        </p>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <AdminButton variant="danger" onClick={() => setOpen(true)}>
          Șterge contul
        </AdminButton>
      </AdminCard>

      {open && (
        <AdminModal
          title="Ștergere cont"
          subtitle="Confirmare obligatorie"
          onClose={loading ? undefined : resetModal}
        >
          {step === "warn" ? (
            <div className="space-y-4">
              <p className="text-sm text-frz-ink">
                Contul tău va fi programat pentru ștergere. Ai la dispoziție 7
                zile pentru a anula solicitarea. După această perioadă, datele
                care nu trebuie păstrate conform obligațiilor legale vor fi
                șterse sau anonimizate.
              </p>
              <div>
                <label className="block text-sm text-frz-muted mb-2">
                  De ce dorești să renunți la Frizeo? (opțional)
                </label>
                <select
                  className="w-full bg-frz-fog border border-frz-line rounded-lg px-4 py-3 text-sm"
                  value={reason}
                  onChange={(e) =>
                    setReason(e.target.value as AccountDeletionReason | "")
                  }
                >
                  <option value="">Alege un motiv (opțional)</option>
                  {ACCOUNT_DELETION_REASONS.map((value) => (
                    <option key={value} value={value}>
                      {ACCOUNT_DELETION_REASON_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              {reason === "other" && (
                <textarea
                  className="w-full bg-frz-fog border border-frz-line rounded-lg px-4 py-3 text-sm"
                  rows={3}
                  maxLength={2000}
                  placeholder="Spune-ne pe scurt, dacă vrei."
                  value={reasonDetails}
                  onChange={(e) => setReasonDetails(e.target.value)}
                />
              )}
              <div className="flex gap-2 justify-end">
                <AdminButton variant="ghost" onClick={resetModal}>
                  Înapoi
                </AdminButton>
                <AdminButton variant="danger" onClick={() => setStep("confirm")}>
                  Continuă
                </AdminButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-frz-ink">
                Pentru a confirma, tastează <strong>{email}</strong> și parola
                contului. Folosim aceeași autentificare ca la login.
              </p>
              <input
                type="email"
                autoComplete="username"
                className="w-full bg-frz-fog border border-frz-line rounded-lg px-4 py-3 text-sm"
                placeholder="Email cont"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
              />
              <input
                type="password"
                autoComplete="current-password"
                className="w-full bg-frz-fog border border-frz-line rounded-lg px-4 py-3 text-sm"
                placeholder="Parolă"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="flex gap-2 justify-end">
                <AdminButton
                  variant="ghost"
                  onClick={() => {
                    setStep("warn");
                    setError("");
                  }}
                  disabled={loading}
                >
                  Înapoi
                </AdminButton>
                <AdminButton
                  variant="danger"
                  onClick={submitRequest}
                  loading={loading}
                  loadingLabel="Se programează..."
                >
                  Confirmă ștergerea
                </AdminButton>
              </div>
            </div>
          )}
        </AdminModal>
      )}
    </>
  );
}

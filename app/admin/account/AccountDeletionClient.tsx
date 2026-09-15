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
  failure_reason?: string | null;
};

type EligibleMember = {
  userId: string;
  role: string;
  displayName: string | null;
  email: string | null;
};

type OwnershipBlock = {
  tenantId: string;
  tenantName: string | null;
  eligibleMembers: EligibleMember[];
};

function memberLabel(member: EligibleMember): string {
  const name = member.displayName || member.email || "Membru";
  const email = member.email && member.email !== name ? ` (${member.email})` : "";
  return `${name}${email} — ${member.role}`;
}

export default function AccountDeletionClient({
  email,
  activeRequest,
  ownershipBlocks,
  writesAllowed = true,
  unavailableMessage = null,
  allowImmediateFinalize = false,
}: {
  email: string;
  activeRequest: ActiveRequest | null;
  ownershipBlocks: OwnershipBlock[];
  writesAllowed?: boolean;
  unavailableMessage?: string | null;
  allowImmediateFinalize?: boolean;
}) {
  const router = useRouter();
  const [request, setRequest] = useState(activeRequest);
  const [blocks, setBlocks] = useState(ownershipBlocks);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"warn" | "confirm">("warn");
  const [reason, setReason] = useState<AccountDeletionReason | "">("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [password, setPassword] = useState("");
  const [typedEmail, setTypedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [finalizeNowLoading, setFinalizeNowLoading] = useState(false);
  const [finalizePassword, setFinalizePassword] = useState("");
  const [transferSelections, setTransferSelections] = useState<Record<string, string>>(
    {},
  );
  const [transferLoading, setTransferLoading] = useState<string | null>(null);

  const scheduledLabel = useMemo(
    () => (request ? formatDeletionDateRo(request.scheduled_for) : ""),
    [request],
  );
  const ownershipBlocked = blocks.length > 0;

  if (!writesAllowed) {
    return (
      <AdminCard className="border-amber-200 bg-amber-50/60 space-y-3">
        <h2 className="text-lg font-semibold text-frz-ink">Ștergere cont</h2>
        <p className="text-sm text-frz-ink">
          {unavailableMessage ||
            "Ștergerea contului nu este disponibilă pe această instanță."}
        </p>
      </AdminCard>
    );
  }

  function resetModal() {
    setOpen(false);
    setStep("warn");
    setPassword("");
    setTypedEmail("");
    setError("");
  }

  async function refreshOwnership() {
    const res = await fetch("/api/account-deletion/status", {
      credentials: "include",
    });
    const data = await res.json();
    if (res.ok && Array.isArray(data.ownership?.tenants)) {
      setBlocks(data.ownership.tenants);
    }
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

  async function finalizeNow() {
    if (!finalizePassword) {
      setError("Parola este obligatorie.");
      return;
    }
    setFinalizeNowLoading(true);
    setError("");
    try {
      const res = await fetch("/api/account-deletion/finalize-self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: finalizePassword }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Nu am putut finaliza ștergerea.");
        return;
      }
      window.location.href = "/login?deleted=1";
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setFinalizeNowLoading(false);
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

  async function transferOwnership(tenantId: string) {
    const toUserId = transferSelections[tenantId];
    if (!toUserId) {
      setError("Alege un membru căruia să-i transferi ownership-ul.");
      return;
    }
    setTransferLoading(tenantId);
    setError("");
    try {
      const res = await fetch("/api/account-deletion/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId, toUserId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Nu am putut transfera ownership-ul.");
        return;
      }
      await refreshOwnership();
      router.refresh();
    } catch {
      setError("Eroare de rețea. Încearcă din nou.");
    } finally {
      setTransferLoading(null);
    }
  }

  const ownershipNotice = ownershipBlocked ? (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm text-amber-950">
        Salonul nu poate rămâne fără owner. Poți programa ștergerea, dar
        finalizarea este blocată până transferi ownership-ul unui membru
        eligibil. Transferul nu se face automat.
      </p>
      {blocks.map((block) => (
        <div key={block.tenantId} className="space-y-2">
          <p className="text-sm font-medium text-frz-ink">
            {block.tenantName || "Salon"}
          </p>
          {block.eligibleMembers.length === 0 ? (
            <p className="text-sm text-frz-muted">
              Nu există un alt membru eligibil în acest salon.
            </p>
          ) : (
            <>
              <select
                className="w-full bg-white border border-frz-line rounded-lg px-4 py-3 text-sm"
                value={transferSelections[block.tenantId] || ""}
                onChange={(e) =>
                  setTransferSelections((prev) => ({
                    ...prev,
                    [block.tenantId]: e.target.value,
                  }))
                }
              >
                <option value="">Alege membrul care preia salonul</option>
                {block.eligibleMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {memberLabel(member)}
                  </option>
                ))}
              </select>
              <AdminButton
                variant="secondary"
                onClick={() => transferOwnership(block.tenantId)}
                loading={transferLoading === block.tenantId}
                loadingLabel="Se transferă..."
              >
                Transferă ownership-ul
              </AdminButton>
            </>
          )}
        </div>
      ))}
    </div>
  ) : null;

  if (request?.status === "pending" || request?.status === "processing") {
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
        {ownershipNotice}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <AdminButton
          variant="secondary"
          onClick={cancelDeletion}
          loading={cancelLoading}
          loadingLabel="Se anulează..."
        >
          Anulează ștergerea
        </AdminButton>
        {allowImmediateFinalize && (
          <div className="space-y-2 pt-2 border-t border-red-200">
            <p className="text-xs text-frz-muted">
              Doar staging: poți finaliza imediat pe un cont de test, fără
              așteptarea de 7 zile.
            </p>
            <input
              type="password"
              autoComplete="current-password"
              className="w-full bg-white border border-frz-line rounded-lg px-4 py-3 text-sm"
              placeholder="Parola contului de test"
              value={finalizePassword}
              onChange={(e) => setFinalizePassword(e.target.value)}
            />
            <AdminButton
              variant="danger"
              onClick={finalizeNow}
              loading={finalizeNowLoading}
              loadingLabel="Se șterge..."
            >
              Finalizează acum (staging)
            </AdminButton>
          </div>
        )}
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
          șterse automat. Facturile rămân ca evidențe financiar-contabile.
        </p>
        {ownershipNotice}
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
                care nu trebuie păstrate vor fi șterse sau anonimizate.
                Programările viitoare ale frizerului tău sunt anulate, iar
                clienții sunt notificați. Evenimentele din Google Calendar nu
                sunt șterse.
              </p>
              {ownershipBlocked && (
                <p className="text-sm text-amber-900">
                  Ești owner și salonul mai are alți membri. Ștergerea se poate
                  programa, dar nu se finalizează până transferi ownership-ul
                  unui membru ales de tine.
                </p>
              )}
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

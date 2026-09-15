"use client";

import { useMemo, useState } from "react";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import AdminModal from "../components/AdminModal";
import {
  ACCOUNT_DELETION_REASON_LABELS,
  formatDeletionDateRo,
  type AccountDeletionReason,
} from "@/lib/account-deletion/constants";

type AdminDeletionRow = {
  id: string;
  user_id: string | null;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  email_snapshot: string;
  reason: AccountDeletionReason | null;
  reason_details: string | null;
  status: string;
  requested_at: string;
  scheduled_for: string;
  cancelled_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 border-amber-200",
    processing: "bg-sky-50 text-sky-800 border-sky-200",
    completed: "bg-emerald-50 text-emerald-800 border-emerald-200",
    cancelled: "bg-frz-fog text-frz-muted border-frz-line",
    failed: "bg-red-50 text-red-800 border-red-200",
  };
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${styles[status] || styles.cancelled}`}
    >
      {status}
    </span>
  );
}

export default function AccountDeletionsClient({
  initialRequests,
  simulateExpiryEnabled,
}: {
  initialRequests: AdminDeletionRow[];
  simulateExpiryEnabled: boolean;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [selected, setSelected] = useState<AdminDeletionRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    return requests.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
  }, [requests]);

  async function runAction(id: string, action: string) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/account-deletion/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Acțiunea a eșuat.");
        return;
      }
      const updated = data.request as Partial<AdminDeletionRow>;
      setRequests((prev) =>
        prev.map((row) => (row.id === id ? { ...row, ...updated } : row)),
      );
      setSelected((current) =>
        current?.id === id ? { ...current, ...updated } : current,
      );
      setConfirmDelete(false);
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs text-frz-muted">
        {Object.entries(counts).map(([status, count]) => (
          <span key={status}>
            {status}: {count}
          </span>
        ))}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <AdminCard padding="sm" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-frz-muted border-b border-frz-line">
              <th className="py-2 pr-3">Salon</th>
              <th className="py-2 pr-3">User / email</th>
              <th className="py-2 pr-3">Solicitat</th>
              <th className="py-2 pr-3">Motiv</th>
              <th className="py-2 pr-3">Programat</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((row) => (
              <tr key={row.id} className="border-b border-frz-line/70">
                <td className="py-2 pr-3">
                  {row.tenant_name || "—"}
                  {row.tenant_slug ? (
                    <div className="text-xs text-frz-muted">{row.tenant_slug}</div>
                  ) : null}
                </td>
                <td className="py-2 pr-3">{row.email_snapshot}</td>
                <td className="py-2 pr-3">{formatDeletionDateRo(row.requested_at)}</td>
                <td className="py-2 pr-3">
                  {row.reason
                    ? ACCOUNT_DELETION_REASON_LABELS[row.reason]
                    : "—"}
                </td>
                <td className="py-2 pr-3">{formatDeletionDateRo(row.scheduled_for)}</td>
                <td className="py-2 pr-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="py-2">
                  <AdminButton
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelected(row);
                      setConfirmDelete(false);
                    }}
                  >
                    View
                  </AdminButton>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-frz-muted">
                  Nicio solicitare de ștergere.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </AdminCard>

      {selected && (
        <AdminModal
          title="Solicitare ștergere cont"
          subtitle="Acțiunile de aici șterg un utilizator, nu un salon întreg."
          onClose={busy ? undefined : () => setSelected(null)}
          maxWidth="max-w-lg"
        >
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-frz-muted">Salon</dt>
              <dd>{selected.tenant_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-frz-muted">Email</dt>
              <dd>{selected.email_snapshot}</dd>
            </div>
            <div>
              <dt className="text-frz-muted">Status</dt>
              <dd>
                <StatusBadge status={selected.status} />
              </dd>
            </div>
            <div>
              <dt className="text-frz-muted">Motiv</dt>
              <dd>
                {selected.reason
                  ? ACCOUNT_DELETION_REASON_LABELS[selected.reason]
                  : "—"}
                {selected.reason_details ? ` — ${selected.reason_details}` : ""}
              </dd>
            </div>
            {selected.failure_reason && (
              <div>
                <dt className="text-frz-muted">Eroare</dt>
                <dd className="text-red-700">{selected.failure_reason}</dd>
              </div>
            )}
          </dl>

          {selected.status === "pending" && !confirmDelete && (
            <div className="flex flex-wrap gap-2 pt-2">
              <AdminButton
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => runAction(selected.id, "cancel")}
              >
                Cancel deletion
              </AdminButton>
              {simulateExpiryEnabled && (
                <AdminButton
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => runAction(selected.id, "simulate_expiry")}
                >
                  Simulează expirarea
                </AdminButton>
              )}
              <AdminButton
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Delete now
              </AdminButton>
            </div>
          )}

          {confirmDelete && (
            <div className="space-y-3 border border-red-200 rounded-xl p-4 bg-red-50">
              <p className="text-sm text-red-800">
                Ștergi <strong>doar utilizatorul</strong> {selected.email_snapshot}.
                Nu se șterge tenant-ul, nici programările salonului. Aceasta
                rulează aceeași procedură ca worker-ul zilnic.
              </p>
              <div className="flex gap-2 justify-end">
                <AdminButton
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  Înapoi
                </AdminButton>
                <AdminButton
                  variant="danger"
                  size="sm"
                  loading={busy}
                  loadingLabel="Se șterge..."
                  onClick={() => runAction(selected.id, "delete_now")}
                >
                  Confirmă Delete now
                </AdminButton>
              </div>
            </div>
          )}
        </AdminModal>
      )}
    </div>
  );
}

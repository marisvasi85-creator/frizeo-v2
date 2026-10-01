"use client";

import { useState } from "react";
import AdminButton from "../components/AdminButton";
import AdminCard from "../components/AdminCard";
import { AdminInput } from "../components/AdminInput";
import AdminModal from "../components/AdminModal";

type SearchHit = {
  id: string;
  name: string | null;
  slug: string | null;
  planName: string | null;
  planSlug: string | null;
  status: string | null;
  hasStripeSubscription: boolean;
};

type RefundView = {
  tenant: { id: string; name: string | null; slug: string | null } | null;
  subscription: {
    planName: string | null;
    planSlug: string | null;
    status: string | null;
    stripeStatus: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  } | null;
  invoice: {
    id: string;
    amount: number;
    currency: string;
    paidAt: number | null;
    status: string | null;
    refunded: "none" | "partial" | "full" | "action_required";
  } | null;
  canRefund: boolean;
  resumeOnly: boolean;
  blockCode: string | null;
  blockMessage: string | null;
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("ro-RO", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function formatPaidAt(paidAt: number | null): string {
  if (!paidAt) return "—";
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(paidAt * 1000));
}

const REFUND_LABEL: Record<"none" | "partial" | "full" | "action_required", string> = {
  none: "ne-refundată",
  partial: "refund parțial",
  full: "refundată integral",
  action_required: "refund în așteptarea unei acțiuni",
};

export default function BillingRefundsClient() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [view, setView] = useState<RefundView | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setView(null);
    try {
      const res = await fetch(
        `/api/admin/billing/refund?q=${encodeURIComponent(query)}`,
        { credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Căutarea a eșuat.");
        setHits([]);
        return;
      }
      setHits(data.tenants ?? []);
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setBusy(false);
    }
  }

  async function openTenant(tenantId: string) {
    setBusy(true);
    setError("");
    setNotice("");
    setConfirmOpen(false);
    setUnderstood(false);
    try {
      const res = await fetch(
        `/api/admin/billing/refund?tenantId=${encodeURIComponent(tenantId)}`,
        { credentials: "include" },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Nu am putut încărca billing-ul.");
        setView(null);
        return;
      }
      setView(data as RefundView);
    } catch {
      setError("Eroare de rețea.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmRefund() {
    if (!view?.tenant || !understood) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/billing/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ tenantId: view.tenant.id, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        const message = data.error || "Refund-ul a eșuat.";
        setConfirmOpen(false);
        await openTenant(view.tenant.id);
        setError(message);
        return;
      }
      setNotice(
        data.code === "already_reconciled"
          ? "Refund-ul era deja finalizat. Nu s-a emis o plată nouă."
          : "Refund integral emis. Abonamentul a fost anulat și salonul este pe Free.",
      );
      setConfirmOpen(false);
      setUnderstood(false);
      await openTenant(view.tenant.id);
    } catch {
      setError("Eroare de rețea. Verifică Stripe înainte să reîncerci.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <AdminInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nume sau slug salon"
          aria-label="Caută salon"
        />
        <AdminButton type="submit" loading={busy} disabled={query.trim().length < 2}>
          Caută
        </AdminButton>
      </form>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

      {hits.length > 0 && (
        <AdminCard padding="sm" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-frz-muted border-b border-frz-line">
                <th className="py-2 pr-3">Salon</th>
                <th className="py-2 pr-3">Plan</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Stripe</th>
              </tr>
            </thead>
            <tbody>
              {hits.map((hit) => (
                <tr key={hit.id} className="border-b border-frz-line/70">
                  <td className="py-2 pr-3">
                    <button
                      type="button"
                      className="text-left font-medium hover:underline"
                      onClick={() => openTenant(hit.id)}
                    >
                      {hit.name || "—"}
                    </button>
                    <div className="text-xs text-frz-muted">{hit.slug}</div>
                  </td>
                  <td className="py-2 pr-3">{hit.planName || hit.planSlug || "—"}</td>
                  <td className="py-2 pr-3">{hit.status || "—"}</td>
                  <td className="py-2">{hit.hasStripeSubscription ? "da" : "nu"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

      {view?.tenant && (
        <AdminCard className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{view.tenant.name || "Salon"}</h2>
            <p className="text-sm text-frz-muted">{view.tenant.slug}</p>
          </div>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-frz-muted">Plan</dt>
              <dd>{view.subscription?.planName || view.subscription?.planSlug || "—"}</dd>
            </div>
            <div>
              <dt className="text-frz-muted">Status abonament</dt>
              <dd>
                {view.subscription?.status || "—"}
                {view.subscription?.stripeStatus
                  ? ` · Stripe ${view.subscription.stripeStatus}`
                  : ""}
              </dd>
            </div>
            <div>
              <dt className="text-frz-muted">Stripe customer</dt>
              <dd className="font-mono text-xs break-all">
                {view.subscription?.stripeCustomerId || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-frz-muted">Stripe subscription</dt>
              <dd className="font-mono text-xs break-all">
                {view.subscription?.stripeSubscriptionId || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-frz-muted">Factură</dt>
              <dd className="font-mono text-xs break-all">{view.invoice?.id || "—"}</dd>
            </div>
            <div>
              <dt className="text-frz-muted">Sumă</dt>
              <dd>
                {view.invoice
                  ? formatMoney(view.invoice.amount, view.invoice.currency)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-frz-muted">Plătită la</dt>
              <dd>{formatPaidAt(view.invoice?.paidAt ?? null)}</dd>
            </div>
            <div>
              <dt className="text-frz-muted">Status plată</dt>
              <dd>
                {view.invoice
                  ? `${view.invoice.status || "—"} · ${REFUND_LABEL[view.invoice.refunded]}`
                  : "—"}
              </dd>
            </div>
          </dl>
          {view.blockMessage && !view.canRefund ? (
            <p className="text-sm text-frz-muted">{view.blockMessage}</p>
          ) : null}
          {view.canRefund ? (
            <AdminButton
              variant="danger"
              onClick={() => {
                setUnderstood(false);
                setConfirmOpen(true);
              }}
              disabled={busy}
            >
              {view.resumeOnly ? "Finalizează refund-ul" : "Refund plată"}
            </AdminButton>
          ) : null}
        </AdminCard>
      )}

      {confirmOpen && view?.tenant && view.invoice && (
        <AdminModal
          title="Confirm refund"
          subtitle={view.tenant.name || view.tenant.slug || "Salon"}
          onClose={() => setConfirmOpen(false)}
        >
          <div className="space-y-3 text-sm">
            <p>
              Sumă: <strong>{formatMoney(view.invoice.amount, view.invoice.currency)}</strong>
            </p>
            <p className="font-mono text-xs break-all">Factură: {view.invoice.id}</p>
            <p>
              Banii vor fi returnați prin Stripe către metoda de plată folosită la această factură.
            </p>
            <p>
              Abonamentul Stripe va fi anulat imediat, iar salonul va reveni pe planul Free.
              Programările, clienții și istoricul rămân.
            </p>
            {view.resumeOnly ? (
              <p>
                Refund-ul există deja în Stripe. Confirmarea nu emite o a doua returnare; reia
                doar anularea și trecerea pe Free.
              </p>
            ) : null}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={understood}
                onChange={(event) => setUnderstood(event.target.checked)}
              />
              <span>Înțeleg că această acțiune returnează banii și anulează abonamentul.</span>
            </label>
            <div className="flex gap-2 justify-end">
              <AdminButton variant="secondary" onClick={() => setConfirmOpen(false)}>
                Renunță
              </AdminButton>
              <AdminButton
                variant="danger"
                disabled={!understood || busy}
                loading={busy}
                onClick={confirmRefund}
              >
                Confirm refund
              </AdminButton>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

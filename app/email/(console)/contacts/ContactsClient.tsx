"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MarketingContact } from "@/lib/frizeo-email/types";

type Props = {
  initialContacts: MarketingContact[];
  initialTotal: number;
  initialQuery: {
    q: string;
    status: string;
    source: string;
    consent: string;
  };
};

function statusBadge(status: string) {
  const map: Record<string, string> = {
    subscribed: "bg-emerald-500/15 text-emerald-300",
    unsubscribed: "bg-white/10 text-white/60",
    bounced: "bg-amber-500/15 text-amber-200",
    complained: "bg-red-500/15 text-red-300",
  };
  return map[status] || "bg-white/10 text-white/60";
}

export default function ContactsClient({
  initialContacts,
  initialTotal,
  initialQuery,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const contacts = initialContacts;
  const total = initialTotal;
  const [q, setQ] = useState(initialQuery.q);
  const [status, setStatus] = useState(initialQuery.status);
  const [source, setSource] = useState(initialQuery.source);
  const [consent, setConsent] = useState(initialQuery.consent);

  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [unsubscribeLoadingId, setUnsubscribeLoadingId] = useState<
    string | null
  >(null);
  const [unsubscribeLinks, setUnsubscribeLinks] = useState<
    Record<string, string>
  >({});
  const [editContact, setEditContact] = useState<MarketingContact | null>(null);
  const [editConsent, setEditConsent] = useState<"yes" | "no">("no");
  const [editSaving, setEditSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkConsent, setBulkConsent] = useState<"yes" | "no">("yes");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [addForm, setAddForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    phone: "",
    marketing_consent: false,
  });

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== "all") params.set("status", status);
    if (source !== "all") params.set("source", source);
    if (consent !== "all") params.set("consent", consent);
    setSelectedIds(new Set());
    startTransition(() => {
      router.push(`/email/contacts?${params.toString()}`);
    });
  };

  const openEditContact = (contact: MarketingContact) => {
    setFormError(null);
    setFormSuccess(null);
    setEditContact(contact);
    setEditConsent(contact.marketing_consent ? "yes" : "no");
  };

  const onEditContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContact) return;

    setEditSaving(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await fetch(
        `/api/email/contacts/${encodeURIComponent(editContact.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ marketing_consent: editConsent === "yes" }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Nu am putut actualiza contactul.");
        return;
      }

      setFormSuccess(
        data.result === "unchanged"
          ? "Consimțământul era deja setat la valoarea selectată."
          : `Consimțământ actualizat la ${editConsent === "yes" ? "Yes" : "No"}.`,
      );
      setEditContact(null);
      startTransition(() => router.refresh());
    } catch {
      setFormError("Eroare de rețea la actualizarea contactului.");
    } finally {
      setEditSaving(false);
    }
  };

  const toggleContact = (contactId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const allVisibleSelected =
    contacts.length > 0 &&
    contacts.every((contact) => selectedIds.has(contact.id));

  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        contacts.forEach((contact) => next.delete(contact.id));
      } else {
        contacts.forEach((contact) => next.add(contact.id));
      }
      return next;
    });
  };

  const applyBulkConsent = async () => {
    if (selectedIds.size === 0) return;

    const valueLabel = bulkConsent === "yes" ? "Yes" : "No";
    const confirmed = window.confirm(
      `Confirmi schimbarea consimțământului la ${valueLabel} pentru ${selectedIds.size} contacte selectate? Modificarea va fi înregistrată în audit.`,
    );
    if (!confirmed) return;

    setBulkSaving(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const res = await fetch("/api/email/contacts/bulk-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_ids: [...selectedIds],
          marketing_consent: bulkConsent === "yes",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Actualizarea bulk a eșuat.");
        return;
      }

      setFormSuccess(
        `Bulk consent: modificate ${data.changed}, neschimbate ${data.unchanged}, blocate unsubscribe ${data.blocked_unsubscribe || 0}, suprimate bounce/complaint ${data.blocked_suppressed || 0}, lipsă ${data.missing}.`,
      );
      setSelectedIds(new Set());
      startTransition(() => router.refresh());
    } catch {
      setFormError("Eroare de rețea la actualizarea bulk.");
    } finally {
      setBulkSaving(false);
    }
  };

  const deleteContact = async (contact: MarketingContact) => {
    const name = [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "—";
    if (
      !window.confirm(
        `Ștergi definitiv acest contact?\n\n${name}\n${contact.email}\n\nAceastă acțiune nu poate fi anulată.`,
      )
    ) {
      return;
    }
    setDeletingId(contact.id);
    setFormError(null);
    setFormSuccess(null);
    try {
      const response = await fetch(`/api/email/contacts/${contact.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error || "Nu am putut șterge contactul.");
        return;
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(contact.id);
        return next;
      });
      setFormSuccess("Contact șters și datele personale anonimizate. Istoricul campaniilor a fost păstrat.");
      startTransition(() => router.refresh());
    } catch {
      setFormError("Eroare de rețea la ștergerea contactului.");
    } finally {
      setDeletingId(null);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Ștergi definitiv ${selectedIds.size} contacte selectate?\n\nDatele personale active vor fi anonimizate. Această acțiune nu poate fi anulată.`,
      )
    ) {
      return;
    }
    setBulkDeleting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const response = await fetch("/api/email/contacts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_ids: [...selectedIds] }),
      });
      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error || "Nu am putut șterge contactele selectate.");
        return;
      }
      setFormSuccess(`${data.deleted} contacte șterse și anonimizate. Istoricul campaniilor a fost păstrat.`);
      setSelectedIds(new Set());
      startTransition(() => router.refresh());
    } catch {
      setFormError("Eroare de rețea la ștergerea contactelor.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const res = await fetch("/api/email/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error || "Nu am putut adăuga contactul.");
      return;
    }
    setFormSuccess("Contact adăugat.");
    setAddForm({
      email: "",
      first_name: "",
      last_name: "",
      phone: "",
      marketing_consent: false,
    });
    setShowAdd(false);
    startTransition(() => router.refresh());
  };

  const onImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setImportResult(null);
    setFormError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const res = await fetch("/api/email/contacts/import", {
      method: "POST",
      body: fd,
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error || "Import eșuat.");
      return;
    }
    setImportResult(
      `Importate: ${data.imported} · Duplicate: ${data.duplicate} · Invalide: ${data.invalid}`,
    );
    if (Array.isArray(data.errors) && data.errors.length > 0) {
      setImportResult(
        (prev) => `${prev}\n${data.errors.slice(0, 5).join("\n")}`,
      );
    }
    startTransition(() => router.refresh());
  };

  const onSyncFrizeo = async () => {
    setFormError(null);
    setFormSuccess(null);
    const res = await fetch("/api/email/contacts/sync-frizeo", {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error || "Sync eșuat.");
      return;
    }
    setFormSuccess(
      `Sync Frizeo — importate: ${data.imported}, duplicate: ${data.duplicate}, invalide: ${data.invalid}. Fără consimțământ marketing automat.`,
    );
    startTransition(() => router.refresh());
  };

  const createUnsubscribeTestLink = async (contactId: string) => {
    setFormError(null);
    setUnsubscribeLoadingId(contactId);

    try {
      const res = await fetch(
        `/api/email/contacts/${encodeURIComponent(contactId)}/unsubscribe-link`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Nu am putut genera linkul de test.");
        return;
      }

      setUnsubscribeLinks((current) => ({
        ...current,
        [contactId]: String(data.url),
      }));
    } catch {
      setFormError("Eroare de rețea la generarea linkului de test.");
    } finally {
      setUnsubscribeLoadingId(null);
    }
  };

  const empty = contacts.length === 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Contacts
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {total} contacte · marketing consent separat de contul Frizeo
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setShowImport(false);
              setShowAdd((v) => !v);
            }}
            className="rounded-lg bg-white text-black px-3 py-2 text-sm font-medium hover:bg-gray-200"
          >
            Add Contact
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdd(false);
              setShowImport((v) => !v);
            }}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Import CSV
          </button>
          <button
            type="button"
            onClick={onSyncFrizeo}
            className="rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Sync Frizeo owners
          </button>
        </div>
      </header>

      {(formError || formSuccess || importResult) && (
        <div className="space-y-2 text-sm">
          {formError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-200">
              {formError}
            </p>
          )}
          {formSuccess && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-100">
              {formSuccess}
            </p>
          )}
          {importResult && (
            <pre className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/70 whitespace-pre-wrap">
              {importResult}
            </pre>
          )}
        </div>
      )}

      {editContact && (
        <form
          onSubmit={onEditContact}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-medium">Edit Contact</h2>
              <p className="mt-1 text-sm text-white/50">{editContact.email}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditContact(null)}
              className="text-sm text-white/50 hover:text-white"
            >
              Închide
            </button>
          </div>

          <label className="block max-w-xs">
            <span className="mb-1 block text-xs text-white/50">
              Marketing consent
            </span>
            <select
              value={editConsent}
              onChange={(e) => setEditConsent(e.target.value as "yes" | "no")}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          {editConsent === "yes" && (
            <p className="text-xs text-amber-200/80">
              Setează Yes numai dacă ai dovada consimțământului. Contactele cu
              istoric de dezabonare vor fi blocate automat.
            </p>
          )}

          {editContact.unsubscribed_at && (
            <p className="text-xs text-red-200">
              Acest contact s-a dezabonat explicit. Reactivarea la Yes este
              blocată și necesită o acțiune separată de reconsimțire.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={editSaving}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {editSaving ? "Se salvează…" : "Salvează"}
            </button>
            <button
              type="button"
              onClick={() => setEditContact(null)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/70"
            >
              Anulează
            </button>
          </div>
        </form>
      )}

      {showAdd && (
        <form
          onSubmit={onAdd}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 grid md:grid-cols-2 gap-3"
        >
          <input
            required
            type="email"
            placeholder="Email *"
            value={addForm.email}
            onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Telefon"
            value={addForm.phone}
            onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Prenume"
            value={addForm.first_name}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, first_name: e.target.value }))
            }
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="Nume"
            value={addForm.last_name}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, last_name: e.target.value }))
            }
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={addForm.marketing_consent}
              onChange={(e) =>
                setAddForm((f) => ({
                  ...f,
                  marketing_consent: e.target.checked,
                }))
              }
            />
            Are consimțământ marketing (nu bifa dacă nu există)
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-white text-black px-4 py-2 text-sm font-medium"
            >
              Salvează
            </button>
          </div>
        </form>
      )}

      {showImport && (
        <form
          onSubmit={onImport}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
        >
          <p className="text-sm text-white/55">
            Header CSV:{" "}
            <code className="text-white/80">
              email,first_name,last_name,phone,marketing_consent
            </code>
            . Duplicatele pe email (case-insensitive) sunt raportate, fără
            suprascrierea consimțământului / statusului de unsubscribe.
          </p>
          <input
            required
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="block w-full text-sm text-white/70"
          />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" name="grant_consent" value="true" />
            Marchează toate rândurile ca având consimțământ (doar dacă ai dovadă)
          </label>
          <button
            type="submit"
            className="rounded-lg bg-white text-black px-4 py-2 text-sm font-medium"
          >
            Importă
          </button>
        </form>
      )}

      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex-1">
          <label className="block text-xs text-white/40 mb-1">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Email, nume, telefon…"
            className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="subscribed">Subscribed</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
            <option value="complained">Complained</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="manual">Manual</option>
            <option value="csv">CSV</option>
            <option value="frizeo_user">Frizeo user</option>
            <option value="external_lead">External lead</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1">Consent</label>
          <select
            value={consent}
            onChange={(e) => setConsent(e.target.value)}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <button
          type="button"
          onClick={applyFilters}
          disabled={pending}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
        >
          Filter
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center">
        <span className="text-sm text-white/60">
          {selectedIds.size} contacte selectate
        </span>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <span>Set marketing consent</span>
          <select
            value={bulkConsent}
            onChange={(e) => setBulkConsent(e.target.value as "yes" | "no")}
            className="rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-sm"
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <button
          type="button"
          onClick={applyBulkConsent}
          disabled={selectedIds.size === 0 || bulkSaving}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40"
        >
          {bulkSaving ? "Se aplică…" : "Aplică selecției"}
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={selectedIds.size === 0 || bulkDeleting || bulkSaving}
          className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10 disabled:opacity-40"
        >
          {bulkDeleting ? "Se șterg…" : `Delete selected (${selectedIds.size})`}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-left">
            <tr>
              <th className="w-10 px-4 py-3 font-medium">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  aria-label="Selectează toate contactele vizibile"
                />
              </th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Consent</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-white/40"
                >
                  Niciun contact. Adaugă manual, importă CSV sau sync Frizeo.
                </td>
              </tr>
            ) : (
              contacts.map((c) => {
                const name = [c.first_name, c.last_name]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr
                    key={c.id}
                    className="border-t border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3 align-top">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleContact(c.id)}
                        aria-label={`Selectează ${c.email}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{name || "—"}</div>
                      <div className="text-white/50">{c.email}</div>
                      {c.phone && (
                        <div className="text-white/35 text-xs">{c.phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60">{c.source}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs ${statusBadge(c.status)}`}
                      >
                        {c.status}
                      </span>
                      {c.suppression_reason && (
                        <div className="mt-1 max-w-56 text-[11px] text-white/35">
                          {c.suppression_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/60">
                      {c.marketing_consent ? "Yes" : "No"}
                      {(c.consent_source || c.consent_at) && (
                        <div className="text-[11px] text-white/35">
                          {c.consent_source || "sursă necunoscută"}
                          {c.consent_at
                            ? ` · ${new Date(c.consent_at).toLocaleDateString("ro-RO")}`
                            : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/50">
                      {new Date(c.created_at).toLocaleDateString("ro-RO")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-40 flex-col items-start gap-2">
                        <button
                          type="button"
                          onClick={() => openEditContact(c)}
                          className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10"
                        >
                          Edit Contact
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteContact(c)}
                          disabled={deletingId === c.id || bulkDeleting}
                          className="rounded-md border border-red-500/25 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          {deletingId === c.id ? "Se șterge…" : "Delete Contact"}
                        </button>
                        {unsubscribeLinks[c.id] ? (
                          <>
                            <a
                              href={unsubscribeLinks[c.id]}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/20"
                            >
                              Deschide unsubscribe
                            </a>
                            <button
                              type="button"
                              onClick={() =>
                                startTransition(() => router.refresh())
                              }
                              disabled={pending}
                              className="text-xs text-white/45 underline underline-offset-2 hover:text-white/75 disabled:opacity-50"
                            >
                              Actualizează statusul
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => createUnsubscribeTestLink(c.id)}
                            disabled={unsubscribeLoadingId === c.id}
                            className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
                          >
                            {unsubscribeLoadingId === c.id
                              ? "Se generează…"
                              : "Testează unsubscribe"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

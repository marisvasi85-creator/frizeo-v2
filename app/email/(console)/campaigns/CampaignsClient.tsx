"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  MarketingCampaign,
  MarketingEmailTemplate,
} from "@/lib/frizeo-email/types";

function statusClass(status: string): string {
  const colors: Record<string, string> = {
    draft: "bg-white/10 text-white/70",
    scheduled: "bg-blue-500/15 text-blue-200",
    queued: "bg-sky-500/15 text-sky-200",
    sending: "bg-amber-500/15 text-amber-200",
    sent: "bg-emerald-500/15 text-emerald-200",
    partially_failed: "bg-orange-500/15 text-orange-200",
    failed: "bg-red-500/15 text-red-200",
    cancelled: "bg-white/5 text-white/40",
  };
  return colors[status] || colors.draft;
}

export default function CampaignsClient({
  campaigns,
  templates,
}: {
  campaigns: MarketingCampaign[];
  templates: MarketingEmailTemplate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const systemTemplates = templates.filter((item) => item.is_system_template);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(
    systemTemplates[0]?.id || "",
  );
  const [createMode, setCreateMode] = useState<"template" | "blank">("template");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/email/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        template_id: createMode === "template" ? templateId : null,
        mode: createMode,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Nu am putut crea campania.");
      return;
    }
    router.push(`/email/campaigns/${data.campaign.id}`);
  };

  const remove = async (campaign: MarketingCampaign) => {
    const historical = campaign.status !== "draft";
    const confirmation = historical
      ? `Ștergi campania „${campaign.name}” din Frizeo Email?\n\nIstoricul de livrare va fi păstrat pentru consistența analytics și suppression.`
      : `Ștergi definitiv draftul „${campaign.name}”?\n\nAceastă acțiune nu poate fi anulată.`;
    if (!window.confirm(confirmation)) return;
    setBusyId(campaign.id);
    setError(null);
    const response = await fetch(`/api/email/campaigns/${campaign.id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Nu am putut șterge campania.");
      setBusyId(null);
      return;
    }
    setBusyId(null);
    startTransition(() => router.refresh());
  };

  const duplicate = async (campaign: MarketingCampaign) => {
    setBusyId(campaign.id);
    setError(null);
    const response = await fetch(
      `/api/email/campaigns/${campaign.id}/duplicate`,
      { method: "POST" },
    );
    const data = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(data.error || "Nu am putut duplica campania.");
      return;
    }
    router.push(`/email/campaigns/${data.campaign.id}`);
  };

  const cancel = async (campaign: MarketingCampaign) => {
    if (!window.confirm("Oprești destinatarii care nu au fost încă trimiși?")) return;
    setBusyId(campaign.id);
    setError(null);
    const response = await fetch(`/api/email/campaigns/${campaign.id}/cancel`, {
      method: "POST",
    });
    const data = await response.json();
    setBusyId(null);
    if (!response.ok) {
      setError(data.error || "Nu am putut anula campania.");
      return;
    }
    startTransition(() => router.refresh());
  };

  return (
    <div className="max-w-6xl space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Campaigns
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Drafturi, teste, snapshot de audiență și campanii reale în batch-uri.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/email/campaigns/templates"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Templates
          </Link>
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-gray-200"
          >
            Create Campaign
          </button>
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {showCreate && (
        <form
          onSubmit={create}
          className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setCreateMode("template")}
              className={`rounded-xl border p-4 text-left ${createMode === "template" ? "border-white bg-white text-black" : "border-white/10 hover:bg-white/5"}`}
            >
              <span className="block font-medium">Start from Frizeo Template</span>
              <span className="mt-1 block text-xs opacity-60">Conținutul și CTA-ul se completează automat.</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateMode("blank")}
              className={`rounded-xl border p-4 text-left ${createMode === "blank" ? "border-white bg-white text-black" : "border-white/10 hover:bg-white/5"}`}
            >
              <span className="block font-medium">Blank Campaign</span>
              <span className="mt-1 block text-xs opacity-60">Pornește cu un draft gol.</span>
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_320px_auto] md:items-end">
            <label className="space-y-1 text-sm">
            <span className="text-xs text-white/45">Campaign name</span>
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex. Noutăți august"
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2"
            />
            </label>
            {createMode === "template" ? (
              <label className="space-y-1 text-sm">
            <span className="text-xs text-white/45">Template</span>
            <select
              required={createMode === "template"}
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2"
            >
              {systemTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
              </label>
            ) : (
              <div className="text-sm text-white/45">Draft fără template</div>
            )}
          <button
            type="submit"
            disabled={pending || (createMode === "template" && systemTemplates.length === 0)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40"
          >
            Creează draft
          </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.04] text-left text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Audience</th>
              <th className="px-4 py-3 font-medium">Recipients</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-white/40">
                  Nicio campanie. Creează primul draft dintr-un template.
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-t border-white/5">
                  <td className="px-4 py-3">
                    <Link
                      href={`/email/campaigns/${campaign.id}`}
                      className="font-medium hover:underline"
                    >
                      {campaign.name}
                    </Link>
                    <div className="max-w-xs truncate text-xs text-white/40">
                      {campaign.subject || "Fără subiect"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs ${statusClass(campaign.status)}`}
                    >
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/60">
                    {campaign.audience_kind}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white/70">
                    {campaign.recipient_count}
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {new Date(campaign.updated_at).toLocaleDateString("ro-RO")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link
                        href={`/email/campaigns/${campaign.id}`}
                        className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10"
                      >
                        View
                      </Link>
                      {campaign.status === "draft" && (
                        <Link
                          href={`/email/campaigns/${campaign.id}`}
                          className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10"
                        >
                          Edit
                        </Link>
                      )}
                      {!['queued', 'sending', 'scheduled'].includes(campaign.status) && (
                        <button
                          type="button"
                          onClick={() => duplicate(campaign)}
                          disabled={busyId === campaign.id}
                          className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40"
                        >
                          Duplicate
                        </button>
                      )}
                      {['queued', 'sending'].includes(campaign.status) && (
                        <button
                          type="button"
                          onClick={() => cancel(campaign)}
                          disabled={busyId === campaign.id}
                          className="rounded-md border border-amber-500/25 px-2.5 py-1.5 text-xs text-amber-200 hover:bg-amber-500/10 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      )}
                      {!['queued', 'sending', 'scheduled'].includes(campaign.status) && (
                        <button
                          type="button"
                          onClick={() => remove(campaign)}
                          disabled={busyId === campaign.id}
                          className="rounded-md border border-red-500/25 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-white/35">
        Campaniile pornite continuă server-side prin workerul extern chiar dacă
        închizi browserul. Tracking-ul și webhook-urile vor veni separat.
      </p>
    </div>
  );
}

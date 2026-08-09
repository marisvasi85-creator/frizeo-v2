"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { renderMarketingEmail } from "@/lib/frizeo-email/renderEmail";
import type {
  MarketingAudienceSummary,
  MarketingCampaign,
  MarketingCampaignRecipient,
  MarketingEmailTemplate,
} from "@/lib/frizeo-email/types";

type Props = {
  initialCampaign: MarketingCampaign;
  templates: MarketingEmailTemplate[];
  audiences: MarketingAudienceSummary[];
  initialRecipients: MarketingCampaignRecipient[];
};

type CampaignDraft = Pick<
  MarketingCampaign,
  | "name"
  | "subject"
  | "preview_text"
  | "sender_name"
  | "sender_email"
  | "reply_to"
  | "template_id"
  | "heading"
  | "body_text"
  | "image_url"
  | "cta_text"
  | "cta_url"
  | "footer_text"
  | "audience_kind"
>;

function campaignDraft(campaign: MarketingCampaign): CampaignDraft {
  return {
    name: campaign.name,
    subject: campaign.subject,
    preview_text: campaign.preview_text,
    sender_name: campaign.sender_name,
    sender_email: campaign.sender_email,
    reply_to: campaign.reply_to,
    template_id: campaign.template_id,
    heading: campaign.heading,
    body_text: campaign.body_text,
    image_url: campaign.image_url,
    cta_text: campaign.cta_text,
    cta_url: campaign.cta_url,
    footer_text: campaign.footer_text,
    audience_kind: campaign.audience_kind,
  };
}

export default function CampaignEditor({
  initialCampaign,
  templates,
  audiences,
  initialRecipients,
}: Props) {
  const editable = initialCampaign.status === "draft";
  const [draft, setDraft] = useState(() => campaignDraft(initialCampaign));
  const [recipients, setRecipients] = useState(initialRecipients);
  const [snapshotCount, setSnapshotCount] = useState(
    initialCampaign.recipient_count,
  );
  const [snapshotAt, setSnapshotAt] = useState(
    initialCampaign.audience_snapshot_at,
  );
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [testEmail, setTestEmail] = useState("");
  const [busy, setBusy] = useState<"save" | "snapshot" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const previewHtml = useMemo(
    () =>
      renderMarketingEmail({
        ...draft,
        unsubscribeUrl: "https://email.frizeo.ro/unsubscribe/preview",
      }),
    [draft],
  );

  const field = <K extends keyof CampaignDraft>(
    key: K,
    value: CampaignDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const saveDraft = async (showConfirmation = true): Promise<boolean> => {
    setBusy("save");
    setError(null);
    if (showConfirmation) setMessage(null);
    try {
      const response = await fetch(`/api/email/campaigns/${initialCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut salva draftul.");
        return false;
      }
      const saved = data.campaign as MarketingCampaign;
      setDraft(campaignDraft(saved));
      if (saved.audience_snapshot_at === null) {
        setSnapshotAt(null);
        setSnapshotCount(0);
        setRecipients([]);
      }
      if (showConfirmation) setMessage("Draft salvat.");
      return true;
    } catch {
      setError("Eroare de rețea la salvarea draftului.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const refreshRecipients = async () => {
    const response = await fetch(
      `/api/email/campaigns/${initialCampaign.id}/recipients`,
    );
    const data = await response.json();
    if (response.ok) {
      setRecipients(data.recipients || []);
    }
  };

  const createSnapshot = async () => {
    const saved = await saveDraft(false);
    if (!saved) return;
    setBusy("snapshot");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/email/campaigns/${initialCampaign.id}/snapshot`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut genera snapshot-ul.");
        return;
      }
      setSnapshotCount(Number(data.recipient_count || 0));
      setSnapshotAt(new Date().toISOString());
      await refreshRecipients();
      setMessage(
        `Snapshot creat: ${Number(data.recipient_count || 0)} destinatari eligibili.`,
      );
    } catch {
      setError("Eroare de rețea la generarea snapshot-ului.");
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async (event: React.FormEvent) => {
    event.preventDefault();
    const saved = await saveDraft(false);
    if (!saved) return;
    setBusy("test");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/email/campaigns/${initialCampaign.id}/send-test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: testEmail }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut trimite testul.");
        return;
      }
      setMessage(`Test trimis la ${testEmail}. Nu a fost contabilizat în campanie.`);
    } catch {
      setError("Eroare de rețea la trimiterea testului.");
    } finally {
      setBusy(null);
    }
  };

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setDraft((current) => ({
      ...current,
      template_id: template.id,
      subject: template.subject,
      preview_text: template.preview_text,
      heading: template.heading,
      body_text: template.body_text,
      image_url: template.image_url,
      cta_text: template.cta_text,
      cta_url: template.cta_url,
      footer_text: template.footer_text,
    }));
    setMessage(`Template „${template.name}” aplicat local. Apasă Save Draft.`);
  };

  return (
    <div className="max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href="/email/campaigns"
            className="text-xs text-white/45 hover:text-white/75"
          >
            ← Campaigns
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {draft.name}
            </h1>
            <span className="rounded-md bg-white/10 px-2 py-1 text-xs text-white/60">
              {initialCampaign.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/50">
            Faza 2 pregătește campania. Trimiterea reală rămâne blocată.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={() => saveDraft()}
            disabled={busy !== null}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {busy === "save" ? "Se salvează…" : "Save Draft"}
          </button>
        )}
      </header>

      {(error || message) && (
        <div className="space-y-2 text-sm">
          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">
              {message}
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.9fr)]">
        <div className="space-y-5">
          <EditorCard title="Campaign">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Campaign name *"
                value={draft.name}
                disabled={!editable}
                onChange={(value) => field("name", value)}
              />
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-white/45">Apply template</span>
                <select
                  value={draft.template_id || ""}
                  disabled={!editable}
                  onChange={(event) => applyTemplate(event.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 disabled:opacity-60"
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <TextField
              label="Subject *"
              value={draft.subject}
              disabled={!editable}
              onChange={(value) => field("subject", value)}
            />
            <TextField
              label="Preview text"
              value={draft.preview_text}
              disabled={!editable}
              onChange={(value) => field("preview_text", value)}
            />
          </EditorCard>

          <EditorCard title="Sender">
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="Sender name *"
                value={draft.sender_name}
                disabled={!editable}
                onChange={(value) => field("sender_name", value)}
              />
              <TextField
                label="Sender email *"
                type="email"
                value={draft.sender_email}
                disabled={!editable}
                onChange={(value) => field("sender_email", value)}
              />
            </div>
            <TextField
              label="Reply-To"
              type="email"
              value={draft.reply_to || ""}
              disabled={!editable}
              onChange={(value) => field("reply_to", value || null)}
            />
          </EditorCard>

          <EditorCard title="Email content">
            <TextField
              label="Heading"
              value={draft.heading}
              disabled={!editable}
              onChange={(value) => field("heading", value)}
            />
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-white/45">Body *</span>
              <textarea
                rows={10}
                required
                value={draft.body_text}
                disabled={!editable}
                onChange={(event) => field("body_text", event.target.value)}
                className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 disabled:opacity-60"
              />
            </label>
            <TextField
              label="Optional image URL"
              value={draft.image_url || ""}
              disabled={!editable}
              onChange={(value) => field("image_url", value || null)}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <TextField
                label="CTA text"
                value={draft.cta_text || ""}
                disabled={!editable}
                onChange={(value) => field("cta_text", value || null)}
              />
              <TextField
                label="CTA URL"
                value={draft.cta_url || ""}
                disabled={!editable}
                onChange={(value) => field("cta_url", value || null)}
              />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-white/45">Footer</span>
              <textarea
                rows={3}
                value={draft.footer_text}
                disabled={!editable}
                onChange={(event) => field("footer_text", event.target.value)}
                className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 disabled:opacity-60"
              />
            </label>
            <p className="text-xs text-white/35">
              Linkul de dezabonare este inclus automat și nu poate fi eliminat.
            </p>
          </EditorCard>

          <EditorCard title="Audience">
            <div className="grid gap-3 md:grid-cols-3">
              {audiences.map((audience) => (
                <label
                  key={audience.kind}
                  className={`cursor-pointer rounded-lg border p-3 ${
                    draft.audience_kind === audience.kind
                      ? "border-white/40 bg-white/10"
                      : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="radio"
                      name="audience"
                      value={audience.kind}
                      checked={draft.audience_kind === audience.kind}
                      disabled={!editable}
                      onChange={() => field("audience_kind", audience.kind)}
                    />
                    <span className="text-lg font-semibold tabular-nums">
                      {audience.count}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{audience.label}</p>
                  <p className="mt-1 text-xs text-white/40">
                    {audience.description}
                  </p>
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={createSnapshot}
                disabled={!editable || busy !== null}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50"
              >
                {busy === "snapshot" ? "Se generează…" : "Create / Refresh Snapshot"}
              </button>
              <span className="text-sm text-white/50">
                {snapshotAt
                  ? `${snapshotCount} destinatari · ${new Date(snapshotAt).toLocaleString("ro-RO")}`
                  : "Snapshot necreat"}
              </span>
            </div>
          </EditorCard>

          <EditorCard title="Send Test">
            <form onSubmit={sendTest} className="flex flex-col gap-3 md:flex-row">
              <input
                required
                type="email"
                value={testEmail}
                onChange={(event) => setTestEmail(event.target.value)}
                placeholder="adresa@exemplu.ro"
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!editable || busy !== null}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
              >
                {busy === "test" ? "Se trimite…" : "Send Test"}
              </button>
            </form>
            <p className="text-xs text-white/35">
              Testul păstrează subiectul și conținutul campaniei, nu intră în
              snapshot și nu modifică statisticile.
            </p>
          </EditorCard>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-white/40">Preview</p>
            <div className="flex rounded-lg border border-white/10 p-1 text-xs">
              {(["desktop", "mobile"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded-md px-2.5 py-1 ${
                    previewMode === mode ? "bg-white text-black" : "text-white/55"
                  }`}
                >
                  {mode === "desktop" ? "Desktop" : "Mobile"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#171719] p-3">
            <iframe
              title="Campaign email preview"
              srcDoc={previewHtml}
              sandbox=""
              className={`mx-auto h-[760px] bg-white transition-all ${
                previewMode === "mobile" ? "w-[390px] max-w-full" : "w-full"
              }`}
            />
          </div>
        </aside>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Snapshot recipients</h2>
          <p className="text-sm text-white/45">
            Lista rămâne fixă după lansare; în draft o poți regenera controlat.
          </p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="min-w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-white/50">
              <tr>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-white/40">
                    Nu există încă un snapshot pentru această campanie.
                  </td>
                </tr>
              ) : (
                recipients.map((recipient) => (
                  <tr key={recipient.id} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      {[recipient.first_name, recipient.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-white/60">{recipient.email}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-white/60">
                        {recipient.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-white/45">
        Send Now și Schedule se activează în Faza 3 după implementarea queue-ului,
        idempotency și webhook-urilor. În Faza 2 nu există nicio cale de trimitere
        către snapshot.
      </section>
    </div>
  );
}

function EditorCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h2 className="text-base font-medium">{title}</h2>
      {children}
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  type?: "text" | "email";
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs text-white/45">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 disabled:opacity-60"
      />
    </label>
  );
}

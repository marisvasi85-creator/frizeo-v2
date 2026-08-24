"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { renderMarketingEmail } from "@/lib/frizeo-email/renderEmail";
import {
  marketingCtaUrl,
  resolveMarketingTemplateVariables,
} from "@/lib/frizeo-email/templateVariables";
import type {
  MarketingAudienceSummary,
  MarketingCampaign,
  MarketingCampaignProgress,
  MarketingCampaignRecipient,
  MarketingConversionStats,
  MarketingEmailTemplate,
  MarketingSegmentSummary,
  MarketingTestContactOption,
} from "@/lib/frizeo-email/types";
import { useEmailHref } from "../../components/EmailPathContext";

type Props = {
  initialCampaign: MarketingCampaign;
  templates: MarketingEmailTemplate[];
  audiences: MarketingAudienceSummary[];
  segments: MarketingSegmentSummary[];
  testContacts: MarketingTestContactOption[];
  initialRecipients: MarketingCampaignRecipient[];
  initialProgress: MarketingCampaignProgress;
  initialConversions: MarketingConversionStats;
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
  | "segment_id"
  | "test_contact_ids"
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
    segment_id: campaign.segment_id,
    test_contact_ids: campaign.test_contact_ids || [],
  };
}

export default function CampaignEditor({
  initialCampaign,
  templates,
  audiences,
  segments,
  testContacts,
  initialRecipients,
  initialProgress,
  initialConversions,
}: Props) {
  const hrefFor = useEmailHref();
  const [campaignStatus, setCampaignStatus] = useState(initialCampaign.status);
  const editable = campaignStatus === "draft";
  const [draft, setDraft] = useState(() => campaignDraft(initialCampaign));
  const [recipients, setRecipients] = useState(initialRecipients);
  const [progress, setProgress] = useState(initialProgress);
  const conversions = initialConversions;
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
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [busy, setBusy] = useState<
    "save" | "snapshot" | "test" | "queue" | "cancel" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recipientFilter, setRecipientFilter] = useState("all");

  const audienceLabel =
    draft.audience_kind === "segment"
      ? segments.find((segment) => segment.id === draft.segment_id)?.name ||
        initialCampaign.segment_name_snapshot ||
        "Segment indisponibil"
      : audiences.find((audience) => audience.kind === draft.audience_kind)?.label ||
        draft.audience_kind;
  const systemSegments = segments.filter((segment) => segment.is_system_segment);
  const customSegments = segments.filter((segment) => !segment.is_system_segment);
  const selectedTemplate = templates.find((template) => template.id === draft.template_id);
  const recommendedSegment = selectedTemplate?.recommended_audience
    ? systemSegments.find(
        (segment) => segment.segment_key === selectedTemplate.recommended_audience,
      ) ?? null
    : null;
  const selectedSegment = segments.find((segment) => segment.id === draft.segment_id) ?? null;
  const sentPercent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.sent / progress.total) * 100))
      : 0;

  const rate = (value: number, base: number) =>
    base > 0 ? `${((value / base) * 100).toFixed(1)}%` : "—";

  const filteredRecipients = useMemo(
    () =>
      recipients.filter((recipient) => {
        if (recipientFilter === "all") return true;
        if (recipientFilter === "sent") return recipient.sent_at != null;
        if (recipientFilter === "delivered") return recipient.delivered_at != null;
        if (recipientFilter === "opened") {
          return recipient.first_opened_at != null || recipient.opened_at != null;
        }
        if (recipientFilter === "clicked") {
          return recipient.first_clicked_at != null || recipient.clicked_at != null;
        }
        if (recipientFilter === "bounced") return recipient.bounced_at != null;
        if (recipientFilter === "complained") return recipient.complained_at != null;
        if (recipientFilter === "unsubscribed") {
          return recipient.unsubscribed_at != null;
        }
        if (recipientFilter === "delayed") {
          return recipient.delivery_delayed_at != null;
        }
        return recipient.status === recipientFilter;
      }),
    [recipientFilter, recipients],
  );

  useEffect(() => {
    if (campaignStatus === "draft") return;

    let stopped = false;
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/email/campaigns/${initialCampaign.id}/progress`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok || stopped) return;

        const nextStatus = data.campaign.status as MarketingCampaign["status"];
        setCampaignStatus(nextStatus);
        setProgress(data.progress as MarketingCampaignProgress);
        setSnapshotCount(Number(data.progress.total || 0));

        const recipientsResponse = await fetch(
          `/api/email/campaigns/${initialCampaign.id}/recipients`,
          { cache: "no-store" },
        );
        const recipientsData = await recipientsResponse.json();
        if (recipientsResponse.ok && !stopped) {
          setRecipients(recipientsData.recipients || []);
        }
      } catch {
        // Polling is best-effort; the next interval retries without UI noise.
      }
    };

    void poll();
    const interval = window.setInterval(poll, 10_000);
    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [campaignStatus, initialCampaign.id]);

  const previewHtml = useMemo(
    () =>
      renderMarketingEmail({
        ...resolveMarketingTemplateVariables(draft, {
          first_name: "Maria",
          app_url:
            typeof window === "undefined"
              ? "https://staging.frizeo.ro"
              : window.location.origin,
        }),
        unsubscribeUrl: "https://email.frizeo.ro/unsubscribe/preview",
      }),
    [draft],
  );

  const field = <K extends keyof CampaignDraft>(
    key: K,
    value: CampaignDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const selectSegment = (segmentId: string) => {
    setDraft((current) => ({
      ...current,
      audience_kind: "segment",
      segment_id: segmentId,
      test_contact_ids: [],
    }));
    setSnapshotAt(null);
    setSnapshotCount(0);
    setRecipients([]);
  };

  const selectBaseAudience = (kind: MarketingCampaign["audience_kind"]) => {
    setDraft((current) => ({
      ...current,
      audience_kind: kind,
      segment_id: null,
    }));
    setSnapshotAt(null);
    setSnapshotCount(0);
    setRecipients([]);
  };

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
      setProgress({
        total: Number(data.recipient_count || 0),
        pending: Number(data.recipient_count || 0),
        sending: 0,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
        unsubscribed: 0,
        failed: 0,
        skipped: 0,
      });
      setMessage(
        `Snapshot creat: ${Number(data.recipient_count || 0)} destinatari eligibili.`,
      );
    } catch {
      setError("Eroare de rețea la generarea snapshot-ului.");
    } finally {
      setBusy(null);
    }
  };

  const prepareSendCampaign = async () => {
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
        setError(data.error || "Nu am putut verifica audiența.");
        return;
      }

      const count = Number(data.recipient_count || 0);
      setSnapshotCount(count);
      setSnapshotAt(new Date().toISOString());
      await refreshRecipients();
      if (count === 0) {
        setError("Audiența nu conține destinatari eligibili.");
        return;
      }
      setShowSendConfirmation(true);
    } catch {
      setError("Eroare de rețea la verificarea audienței.");
    } finally {
      setBusy(null);
    }
  };

  const confirmSendCampaign = async () => {
    setBusy("queue");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/email/campaigns/${initialCampaign.id}/queue`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut porni campania.");
        return;
      }

      setCampaignStatus(data.campaign.status);
      setProgress(data.progress);
      setSnapshotCount(Number(data.recipient_count || 0));
      setShowSendConfirmation(false);
      setMessage(
        `Campania a fost pusă în coadă cu ${Number(data.recipient_count || 0)} destinatari. Poți închide browserul.`,
      );
    } catch {
      setError("Eroare de rețea la pornirea campaniei.");
    } finally {
      setBusy(null);
    }
  };

  const cancelSendCampaign = async () => {
    if (!window.confirm("Oprești destinatarii care nu au fost încă trimiși?")) {
      return;
    }

    setBusy("cancel");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/email/campaigns/${initialCampaign.id}/cancel`,
        { method: "POST" },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut anula campania.");
        return;
      }
      setCampaignStatus(data.campaign.status);
      setProgress(data.progress);
      setMessage("Campania a fost anulată. Emailurile deja trimise rămân trimise.");
    } catch {
      setError("Eroare de rețea la anularea campaniei.");
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
    const appUrl = window.location.origin;
    setDraft((current) => ({
      ...current,
      template_id: template.id,
      subject: template.subject,
      preview_text: template.preview_text,
      heading: template.heading,
      body_text: template.body_text,
      image_url: template.image_url,
      cta_text: template.cta_text,
      cta_url:
        marketingCtaUrl(template.cta_url_type, appUrl) ?? template.cta_url,
      footer_text: template.footer_text,
    }));
    setMessage(`Template „${template.name}” aplicat local. Apasă Save Draft.`);
  };

  return (
    <div className="max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Link
            href={hrefFor("/campaigns")}
            className="text-xs text-frz-muted hover:text-frz-ink"
          >
            ← Campaigns
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {draft.name}
            </h1>
            <span className="rounded-md bg-frz-fog px-2 py-1 text-xs text-frz-ink/60">
              {campaignStatus}
            </span>
          </div>
          <p className="mt-2 text-sm text-frz-muted">
            {editable
              ? "Pregătește conținutul, verifică audiența și pornește trimiterea."
              : "Conținutul și audiența sunt blocate după pornirea campaniei."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["queued", "sending"].includes(campaignStatus) && (
            <button
              type="button"
              onClick={cancelSendCampaign}
              disabled={busy !== null}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-200 disabled:opacity-50"
            >
              {busy === "cancel" ? "Se anulează…" : "Cancel Campaign"}
            </button>
          )}
          {editable && (
            <button
              type="button"
              onClick={() => saveDraft()}
              disabled={busy !== null}
              className="rounded-lg bg-frz-ink px-4 py-2 text-sm font-medium text-frz-ink-contrast disabled:opacity-50"
            >
              {busy === "save" ? "Se salvează…" : "Save Draft"}
            </button>
          )}
        </div>
      </header>

      {!editable && (
        <section className="space-y-4 rounded-xl border border-frz-line bg-frz-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium">Campaign progress</h2>
              <p className="mt-1 text-sm text-frz-muted">
                {progress.sent} / {progress.total} sent
              </p>
            </div>
            <span className="rounded-md bg-frz-fog px-2.5 py-1 text-xs text-frz-ink/70">
              {campaignStatus === "sent"
                ? "Campaign completed"
                : campaignStatus.replaceAll("_", " ")}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-frz-fog">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${sentPercent}%` }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-9">
            {[
              ["Total", progress.total],
              ["Sent", progress.sent],
              ["Delivered", progress.delivered],
              ["Opened", progress.opened],
              ["Clicked", progress.clicked],
              ["Bounced", progress.bounced],
              ["Complained", progress.complained],
              ["Unsubscribed", progress.unsubscribed],
              ["Failed", progress.failed],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-frz-fog p-3">
                <dt className="text-xs text-frz-muted">{label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            {[
              ["Delivery rate", rate(progress.delivered, progress.sent)],
              ["Open rate", rate(progress.opened, progress.delivered)],
              ["Click rate", rate(progress.clicked, progress.delivered)],
              ["Bounce rate", rate(progress.bounced, progress.sent)],
              [
                "Unsubscribe rate",
                rate(progress.unsubscribed, progress.delivered),
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-frz-line/50 p-3">
                <dt className="text-xs text-frz-muted">{label}</dt>
                <dd className="mt-1 font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-frz-muted">
            Opened este orientativ: protecțiile de confidențialitate și proxy-urile
            de imagini pot influența open tracking.
          </p>
          {progress.skipped > 0 && (
            <p className="text-xs text-frz-muted">
              Skipped/suppressed: {progress.skipped}
            </p>
          )}

          <div className="border-t border-frz-line pt-4">
            <h3 className="font-medium">Conversions</h3>
            <p className="mt-1 text-xs text-frz-muted">
              Last Frizeo Email click · fereastră 30 zile · fără Send Test
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Signups", conversions.signups],
                ["Trials", conversions.trials],
                ["Paid", conversions.paid],
                [
                  "Signup rate",
                  conversions.signup_rate == null
                    ? "—"
                    : `${conversions.signup_rate}%`,
                ],
                [
                  "Paid rate",
                  conversions.paid_rate == null
                    ? "—"
                    : `${conversions.paid_rate}%`,
                ],
                [
                  "Attributed MRR",
                  `${conversions.attributed_mrr.toFixed(0)} ${conversions.currency}`,
                ],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-frz-fog p-3">
                  <dt className="text-xs text-frz-muted">{label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

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
                <span className="text-xs text-frz-muted">Apply template</span>
                <select
                  value={draft.template_id || ""}
                  disabled={!editable}
                  onChange={(event) => applyTemplate(event.target.value)}
                  className="w-full rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-frz-ink disabled:opacity-60"
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
                label="Sender email (campaign metadata)"
                type="email"
                value={draft.sender_email}
                disabled={!editable}
                onChange={(value) => field("sender_email", value)}
              />
            </div>
            <TextField
              label="Reply-To (campaign metadata)"
              type="email"
              value={draft.reply_to || ""}
              disabled={!editable}
              onChange={(value) => field("reply_to", value || null)}
            />
            <p className="text-xs text-frz-muted">
              Send Test folosește adresele From și Reply-To configurate
              server-side în Vercel; valorile nu sunt afișate în interfață.
            </p>
          </EditorCard>

          <EditorCard title="Email content">
            <TextField
              label="Heading"
              value={draft.heading}
              disabled={!editable}
              onChange={(value) => field("heading", value)}
            />
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-frz-muted">Body *</span>
              <textarea
                rows={10}
                required
                value={draft.body_text}
                disabled={!editable}
                onChange={(event) => field("body_text", event.target.value)}
                className="w-full resize-y rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-frz-ink disabled:opacity-60"
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
              <span className="text-xs text-frz-muted">Footer</span>
              <textarea
                rows={3}
                value={draft.footer_text}
                disabled={!editable}
                onChange={(event) => field("footer_text", event.target.value)}
                className="w-full resize-y rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-frz-ink disabled:opacity-60"
              />
            </label>
            <p className="text-xs text-frz-muted">
              Linkul de dezabonare este inclus automat și nu poate fi eliminat.
            </p>
          </EditorCard>

          <EditorCard title="Audience">
            {recommendedSegment && (
              <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-100">
                    Recommended audience: {recommendedSegment.name}
                  </p>
                  <p className="mt-1 text-xs text-emerald-100/60">
                    {recommendedSegment.contacts_count} contacte eligibile acum. Segmentul nu este selectat fără confirmarea ta.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => selectSegment(recommendedSegment.id)}
                  disabled={!editable || selectedSegment?.id === recommendedSegment.id}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {selectedSegment?.id === recommendedSegment.id
                    ? "Recommended segment selected"
                    : "Use recommended segment"}
                </button>
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {audiences
                .filter(
                  (audience) =>
                    ["all_subscribed", "controlled_test"].includes(audience.kind) ||
                    audience.kind === draft.audience_kind,
                )
                .map((audience) => (
                <label
                  key={audience.kind}
                  className={`cursor-pointer rounded-lg border p-3 ${
                    draft.audience_kind === audience.kind
                      ? "border-frz-line bg-frz-fog"
                      : "border-frz-line/50 bg-frz-fog"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="radio"
                      name="audience"
                      value={audience.kind}
                      checked={draft.audience_kind === audience.kind}
                      disabled={!editable}
                      onChange={() => selectBaseAudience(audience.kind)}
                    />
                    <span className="text-lg font-semibold tabular-nums">
                      {audience.kind === "controlled_test"
                        ? draft.test_contact_ids.length
                        : audience.count}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium">{audience.label}</p>
                  <p className="mt-1 text-xs text-frz-muted">
                    {audience.description}
                  </p>
                </label>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={`space-y-2 rounded-lg border p-3 ${selectedSegment?.is_system_segment ? "border-frz-line bg-frz-fog" : "border-frz-line/50 bg-frz-fog"}`}>
                <span className="flex items-center justify-between text-sm font-medium">
                  System Segments
                  <span className="tabular-nums text-frz-ink/60">
                    {selectedSegment?.is_system_segment ? selectedSegment.contacts_count : "—"}
                  </span>
                </span>
                <select
                  value={selectedSegment?.is_system_segment ? selectedSegment.id : ""}
                  disabled={!editable}
                  onChange={(event) => event.target.value && selectSegment(event.target.value)}
                  className="w-full rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-sm text-frz-ink"
                >
                  <option value="">Choose a system segment</option>
                  {systemSegments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name} — {segment.contacts_count}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`space-y-2 rounded-lg border p-3 ${selectedSegment && !selectedSegment.is_system_segment ? "border-frz-line bg-frz-fog" : "border-frz-line/50 bg-frz-fog"}`}>
                <span className="flex items-center justify-between text-sm font-medium">
                  Custom Segments
                  <span className="tabular-nums text-frz-ink/60">
                    {selectedSegment && !selectedSegment.is_system_segment ? selectedSegment.contacts_count : "—"}
                  </span>
                </span>
                <select
                  value={selectedSegment && !selectedSegment.is_system_segment ? selectedSegment.id : ""}
                  disabled={!editable || customSegments.length === 0}
                  onChange={(event) => event.target.value && selectSegment(event.target.value)}
                  className="w-full rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-sm text-frz-ink disabled:opacity-50"
                >
                  <option value="">{customSegments.length ? "Choose a custom segment" : "No custom segments"}</option>
                  {customSegments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name} — {segment.contacts_count}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {draft.audience_kind === "controlled_test" && (
              <div className="space-y-2 rounded-lg border border-frz-line bg-frz-fog p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">Contacte de test eligibile</p>
                  <span className="text-xs text-frz-muted">
                    {draft.test_contact_ids.length}/5 selectate
                  </span>
                </div>
                {testContacts.length === 0 ? (
                  <p className="text-xs text-amber-200/80">
                    Adaugă mai întâi contacte controlate cu consimțământ explicit.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {testContacts.map((contact) => {
                      const checked = draft.test_contact_ids.includes(contact.id);
                      const name = [contact.first_name, contact.last_name]
                        .filter(Boolean)
                        .join(" ");
                      return (
                        <label
                          key={contact.id}
                          className="flex items-start gap-2 rounded-md border border-frz-line p-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              !editable ||
                              (!checked && draft.test_contact_ids.length >= 5)
                            }
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...draft.test_contact_ids, contact.id]
                                : draft.test_contact_ids.filter(
                                    (id) => id !== contact.id,
                                  );
                              field("test_contact_ids", next);
                            }}
                          />
                          <span>
                            <span className="block text-frz-ink/80">{name || "—"}</span>
                            <span className="block text-frz-muted">{contact.email}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={createSnapshot}
                disabled={!editable || busy !== null}
                className="rounded-lg border border-frz-line px-4 py-2 text-sm hover:bg-frz-fog disabled:opacity-50"
              >
                {busy === "snapshot" ? "Se generează…" : "Create / Refresh Snapshot"}
              </button>
              <span className="text-sm text-frz-muted">
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
                className="min-w-0 flex-1 rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-sm text-frz-ink"
              />
              <button
                type="submit"
                disabled={!editable || busy !== null}
                className="rounded-lg bg-frz-ink px-4 py-2 text-sm font-medium text-frz-ink-contrast disabled:opacity-50"
              >
                {busy === "test" ? "Se trimite…" : "Send Test"}
              </button>
            </form>
            <p className="text-xs text-frz-muted">
              Testul păstrează subiectul și conținutul campaniei, nu intră în
              snapshot și nu modifică statisticile.
            </p>
          </EditorCard>

          <EditorCard title="Send Campaign">
            <div className="space-y-3">
              <p className="text-sm text-frz-ink/60">
                Lansarea recalculează atomic audiența eligibilă, fixează snapshot-ul
                și mută campania în coada procesată de worker.
              </p>
              <button
                type="button"
                onClick={prepareSendCampaign}
                disabled={!editable || busy !== null}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "snapshot" ? "Se verifică audiența…" : "Send Campaign"}
              </button>
            </div>
          </EditorCard>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-frz-muted">Preview</p>
            <div className="flex rounded-lg border border-frz-line p-1 text-xs">
              {(["desktop", "mobile"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded-md px-2.5 py-1 ${
                    previewMode === mode ? "bg-frz-ink text-frz-ink-contrast" : "text-frz-ink/60"
                  }`}
                >
                  {mode === "desktop" ? "Desktop" : "Mobile"}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-frz-line bg-frz-card p-3">
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">Snapshot recipients</h2>
            <p className="text-sm text-frz-muted">
              Lista rămâne fixă după lansare; evenimentele actualizează livrarea.
            </p>
          </div>
          <label className="text-xs text-frz-muted">
            <span className="mb-1 block">Filter</span>
            <select
              value={recipientFilter}
              onChange={(event) => setRecipientFilter(event.target.value)}
              className="rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-sm text-frz-ink"
            >
              <option value="all">All recipients</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="delayed">Delivery delayed</option>
              <option value="bounced">Bounced</option>
              <option value="complained">Complained</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="failed">Failed</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto rounded-xl border border-frz-line">
          <table className="min-w-full text-sm">
            <thead className="bg-frz-fog text-left text-frz-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Delivery</th>
                <th className="px-4 py-3 font-medium">Opened</th>
                <th className="px-4 py-3 font-medium">Clicked</th>
                <th className="px-4 py-3 font-medium">Unsubscribed</th>
                <th className="px-4 py-3 font-medium">Last event</th>
              </tr>
            </thead>
            <tbody>
              {recipients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-frz-muted">
                    Nu există încă un snapshot pentru această campanie.
                  </td>
                </tr>
              ) : filteredRecipients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-frz-muted">
                    Niciun recipient nu corespunde filtrului selectat.
                  </td>
                </tr>
              ) : (
                filteredRecipients.map((recipient) => (
                  <tr key={recipient.id} className="border-t border-frz-line/50">
                    <td className="px-4 py-3">
                      {[recipient.first_name, recipient.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-frz-ink/60">
                      <a
                        href={`mailto:${recipient.email}`}
                        className="hover:text-frz-ink hover:underline"
                      >
                        {recipient.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-frz-fog px-2 py-0.5 text-xs text-frz-ink/60">
                        {recipient.status}
                      </span>
                      {recipient.bounce_reason && (
                        <div className="mt-1 max-w-64 text-[11px] text-amber-100/55">
                          {recipient.bounce_type || "Bounce"}: {recipient.bounce_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-frz-muted">
                      {recipient.first_opened_at || recipient.opened_at ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-xs text-frz-muted">
                      {recipient.first_clicked_at || recipient.clicked_at ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-xs text-frz-muted">
                      {recipient.unsubscribed_at ? "Yes" : "No"}
                    </td>
                    <td className="px-4 py-3 text-xs text-frz-muted">
                      <span className="block">{recipient.last_event_type || "—"}</span>
                      {recipient.last_event_at && (
                        <span className="block text-frz-muted">
                          {new Date(recipient.last_event_at).toLocaleString("ro-RO")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showSendConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-campaign-title"
            className="w-full max-w-lg space-y-5 rounded-2xl border border-frz-line bg-frz-card p-6 shadow-2xl"
          >
            <div>
              <h2 id="send-campaign-title" className="text-xl font-semibold">
                Confirm campaign send
              </h2>
              <p className="mt-2 text-sm text-amber-100/75">
                După pornire, conținutul, template-ul și audiența nu mai pot fi
                editate.
              </p>
            </div>
            <dl className="space-y-3 text-sm">
              {[
                ["Campaign", draft.name],
                ["Subject", draft.subject],
                ["Audience", audienceLabel],
                ["Eligible recipients", String(snapshotCount)],
                ["Sender", "Resend · mail.frizeo.ro (server-side)"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 border-b border-frz-line pb-2 sm:grid-cols-[150px_1fr]"
                >
                  <dt className="text-frz-muted">{label}</dt>
                  <dd className="break-words text-frz-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowSendConfirmation(false)}
                disabled={busy === "queue"}
                className="rounded-lg border border-frz-line px-4 py-2 text-sm disabled:opacity-50"
              >
                Înapoi
              </button>
              <button
                type="button"
                onClick={confirmSendCampaign}
                disabled={busy === "queue"}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy === "queue" ? "Se pornește…" : "Confirm & Send"}
              </button>
            </div>
          </div>
        </div>
      )}
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
    <section className="space-y-4 rounded-xl border border-frz-line bg-frz-card p-4">
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
      <span className="text-xs text-frz-muted">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-frz-line bg-frz-fog px-3 py-2 text-frz-ink disabled:opacity-60"
      />
    </label>
  );
}

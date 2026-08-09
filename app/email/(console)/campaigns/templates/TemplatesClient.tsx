"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { renderMarketingEmail } from "@/lib/frizeo-email/renderEmail";
import type { MarketingEmailTemplate } from "@/lib/frizeo-email/types";

type TemplateDraft = Pick<
  MarketingEmailTemplate,
  | "name"
  | "subject"
  | "preview_text"
  | "heading"
  | "body_text"
  | "image_url"
  | "cta_text"
  | "cta_url"
  | "footer_text"
>;

const EMPTY_TEMPLATE: TemplateDraft = {
  name: "",
  subject: "",
  preview_text: "",
  heading: "",
  body_text: "",
  image_url: null,
  cta_text: null,
  cta_url: null,
  footer_text: "Frizeo · Programări online pentru frizeri și saloane.",
};

function toDraft(template: MarketingEmailTemplate): TemplateDraft {
  return {
    name: template.name,
    subject: template.subject,
    preview_text: template.preview_text,
    heading: template.heading,
    body_text: template.body_text,
    image_url: template.image_url,
    cta_text: template.cta_text,
    cta_url: template.cta_url,
    footer_text: template.footer_text,
  };
}

export default function TemplatesClient({
  initialTemplates,
}: {
  initialTemplates: MarketingEmailTemplate[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialTemplates[0]?.id ?? null,
  );
  const [draft, setDraft] = useState<TemplateDraft>(
    initialTemplates[0] ? toDraft(initialTemplates[0]) : EMPTY_TEMPLATE,
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = templates.find((item) => item.id === selectedId) ?? null;
  const previewHtml = useMemo(
    () =>
      renderMarketingEmail({
        ...draft,
        unsubscribeUrl: "https://email.frizeo.ro/unsubscribe/preview",
      }),
    [draft],
  );

  const choose = (template: MarketingEmailTemplate) => {
    setSelectedId(template.id);
    setDraft(toDraft(template));
    setError(null);
    setMessage(null);
  };

  const createNew = () => {
    setSelectedId(null);
    setDraft({ ...EMPTY_TEMPLATE });
    setError(null);
    setMessage(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        selectedId ? `/api/email/templates/${selectedId}` : "/api/email/templates",
        {
          method: selectedId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut salva template-ul.");
        return;
      }

      const saved = data.template as MarketingEmailTemplate;
      setTemplates((current) => {
        const exists = current.some((item) => item.id === saved.id);
        return exists
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...current];
      });
      setSelectedId(saved.id);
      setDraft(toDraft(saved));
      setMessage("Template salvat.");
    } catch {
      setError("Eroare de rețea la salvarea template-ului.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm(`Ștergi template-ul „${selected.name}”?`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/email/templates/${selected.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut șterge template-ul.");
        return;
      }
      const remaining = templates.filter((item) => item.id !== selected.id);
      setTemplates(remaining);
      setSelectedId(remaining[0]?.id ?? null);
      setDraft(remaining[0] ? toDraft(remaining[0]) : { ...EMPTY_TEMPLATE });
      setMessage("Template șters.");
    } catch {
      setError("Eroare de rețea la ștergerea template-ului.");
    } finally {
      setSaving(false);
    }
  };

  const field = <K extends keyof TemplateDraft>(
    key: K,
    value: TemplateDraft[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href="/email/campaigns"
            className="text-xs text-white/45 hover:text-white/75"
          >
            ← Campaigns
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            Email Templates
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Template HTML responsive, cu câmpuri simple și date escapate.
          </p>
        </div>
        <button
          type="button"
          onClick={createNew}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black"
        >
          New Template
        </button>
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

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_minmax(320px,0.9fr)]">
        <aside className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => choose(template)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                selectedId === template.id
                  ? "bg-white text-black"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              <span className="block font-medium">{template.name}</span>
              {template.is_default && (
                <span className="text-[10px] uppercase tracking-wide opacity-60">
                  Default
                </span>
              )}
            </button>
          ))}
          {templates.length === 0 && (
            <p className="px-2 py-4 text-xs text-white/40">Niciun template.</p>
          )}
        </aside>

        <form
          onSubmit={save}
          className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="Template name *"
              value={draft.name}
              onChange={(value) => field("name", value)}
            />
            <TextField
              label="Subject"
              value={draft.subject}
              onChange={(value) => field("subject", value)}
            />
          </div>
          <TextField
            label="Preview text"
            value={draft.preview_text}
            onChange={(value) => field("preview_text", value)}
          />
          <TextField
            label="Heading"
            value={draft.heading}
            onChange={(value) => field("heading", value)}
          />
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-white/45">Body *</span>
            <textarea
              required
              rows={9}
              value={draft.body_text}
              onChange={(event) => field("body_text", event.target.value)}
              className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2"
            />
          </label>
          <TextField
            label="Optional image URL"
            value={draft.image_url || ""}
            onChange={(value) => field("image_url", value || null)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label="CTA text"
              value={draft.cta_text || ""}
              onChange={(value) => field("cta_text", value || null)}
            />
            <TextField
              label="CTA URL"
              value={draft.cta_url || ""}
              onChange={(value) => field("cta_url", value || null)}
            />
          </div>
          <label className="block space-y-1 text-sm">
            <span className="text-xs text-white/45">Footer</span>
            <textarea
              rows={3}
              value={draft.footer_text}
              onChange={(event) => field("footer_text", event.target.value)}
              className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
            >
              {saving ? "Se salvează…" : selectedId ? "Save Template" : "Create Template"}
            </button>
            {selected && !selected.is_default && (
              <button
                type="button"
                onClick={remove}
                disabled={saving}
                className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-200 hover:bg-red-500/10"
              >
                Delete
              </button>
            )}
          </div>
        </form>

        <section className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/40">Preview</p>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white">
            <iframe
              title="Email template preview"
              srcDoc={previewHtml}
              className="h-[720px] w-full bg-white"
              sandbox=""
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-xs text-white/45">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2"
      />
    </label>
  );
}

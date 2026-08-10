"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  SEGMENT_FIELD_CONFIG,
  operatorsForSegmentField,
  segmentFieldConfig,
} from "@/lib/frizeo-email/segmentDefinition";
import type {
  MarketingSegment,
  MarketingSegmentCondition,
  MarketingSegmentDefinition,
  MarketingSegmentField,
  MarketingSegmentMember,
  MarketingSegmentOperator,
  MarketingSegmentSummary,
} from "@/lib/frizeo-email/types";

type SegmentForm = {
  name: string;
  description: string;
  category: string;
  conditions: MarketingSegmentCondition[];
};

const EMPTY_FORM: SegmentForm = {
  name: "",
  description: "",
  category: "custom",
  conditions: [
    { field: "account_status", operator: "equals", value: "registered" },
  ],
};

const OPERATOR_LABELS: Record<MarketingSegmentOperator, string> = {
  equals: "Equals",
  not_equals: "Not equals",
  in: "In",
  greater_than: "Greater than",
  less_than: "Less than",
  before: "Before",
  after: "After",
  yes: "Yes",
  no: "No",
};

function definitionFromForm(form: SegmentForm): MarketingSegmentDefinition {
  return { version: 1, logic: "AND", conditions: form.conditions };
}

function formFromSegment(segment: MarketingSegment): SegmentForm {
  return {
    name: segment.name,
    description: segment.description,
    category: segment.is_system_segment ? "custom" : segment.category,
    conditions: segment.definition.conditions.map((condition) => ({
      ...condition,
      value: Array.isArray(condition.value) ? [...condition.value] : condition.value,
    })),
  };
}

function defaultCondition(field: MarketingSegmentField): MarketingSegmentCondition {
  const config = segmentFieldConfig(field)!;
  const operator = operatorsForSegmentField(field)[0];
  if (config.kind === "boolean") return { field, operator };
  if (config.kind === "number") return { field, operator, value: 0 };
  if (config.kind === "date") {
    return { field, operator, value: new Date().toISOString().slice(0, 10) };
  }
  return { field, operator, value: config.values?.[0]?.value || "" };
}

function SegmentTable({
  segments,
  busyId,
  onView,
  onUse,
  onDuplicate,
  onEdit,
  onDelete,
}: {
  segments: MarketingSegmentSummary[];
  busyId: string | null;
  onView: (segment: MarketingSegmentSummary) => void;
  onUse: (segment: MarketingSegmentSummary) => void;
  onDuplicate: (segment: MarketingSegmentSummary) => void;
  onEdit?: (segment: MarketingSegmentSummary) => void;
  onDelete?: (segment: MarketingSegmentSummary) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full text-sm">
        <thead className="bg-white/[0.04] text-left text-white/50">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Description</th>
            <th className="px-4 py-3 font-medium">Contacts</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Last evaluated</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {segments.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-white/40">
                Niciun segment.
              </td>
            </tr>
          ) : (
            segments.map((segment) => (
              <tr key={segment.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-3">
                  <span className="font-medium">{segment.name}</span>
                  <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-white/45">
                    {segment.category}
                  </span>
                </td>
                <td className="max-w-sm px-4 py-3 text-white/55">
                  {segment.description}
                </td>
                <td className="px-4 py-3 text-lg font-semibold tabular-nums">
                  {segment.contacts_count}
                </td>
                <td className="px-4 py-3 text-white/60">
                  {segment.is_system_segment ? "System" : "Custom"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-white/45">
                  {new Date(segment.evaluated_at).toLocaleString("ro-RO")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex min-w-max flex-wrap gap-2">
                    <button type="button" onClick={() => onView(segment)} className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10">
                      View
                    </button>
                    <button type="button" onClick={() => onUse(segment)} disabled={busyId === segment.id} className="rounded-md border border-emerald-500/25 px-2.5 py-1.5 text-xs text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-40">
                      Use in Campaign
                    </button>
                    <button type="button" onClick={() => onDuplicate(segment)} disabled={busyId === segment.id} className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10 disabled:opacity-40">
                      Duplicate &amp; Edit
                    </button>
                    {onEdit && (
                      <button type="button" onClick={() => onEdit(segment)} className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs hover:bg-white/10">
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button type="button" onClick={() => onDelete(segment)} disabled={busyId === segment.id} className="rounded-md border border-red-500/25 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-40">
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
  );
}

export default function SegmentsClient({
  initialSegments,
}: {
  initialSegments: MarketingSegmentSummary[];
}) {
  const router = useRouter();
  const [segments, setSegments] = useState(initialSegments);
  const [selected, setSelected] = useState<MarketingSegment | null>(null);
  const [members, setMembers] = useState<MarketingSegmentMember[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SegmentForm>(EMPTY_FORM);
  const [previewMembers, setPreviewMembers] = useState<MarketingSegmentMember[]>([]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const systemSegments = useMemo(
    () => segments.filter((segment) => segment.is_system_segment),
    [segments],
  );
  const customSegments = useMemo(
    () => segments.filter((segment) => !segment.is_system_segment),
    [segments],
  );

  const refresh = async () => {
    const response = await fetch("/api/email/segments", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setSegments(data.segments || []);
  };

  const view = async (segment: MarketingSegmentSummary) => {
    setBusyId(segment.id);
    setError(null);
    try {
      const response = await fetch(`/api/email/segments/${segment.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut evalua segmentul.");
        return;
      }
      setSelected(data.segment);
      setMembers(data.members || []);
      setMemberTotal(Number(data.total || 0));
    } catch {
      setError("Eroare de rețea la evaluarea segmentului.");
    } finally {
      setBusyId(null);
    }
  };

  const createNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, conditions: [...EMPTY_FORM.conditions] });
    setPreviewMembers([]);
    setPreviewCount(null);
    setShowBuilder(true);
    setError(null);
    setMessage(null);
  };

  const edit = (segment: MarketingSegmentSummary) => {
    setEditingId(segment.id);
    setForm(formFromSegment(segment));
    setPreviewMembers([]);
    setPreviewCount(null);
    setShowBuilder(true);
    setError(null);
    setMessage(null);
  };

  const preview = async () => {
    setBusyId(editingId || "preview");
    setError(null);
    try {
      const response = await fetch("/api/email/segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition: definitionFromForm(form) }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut calcula preview-ul.");
        return;
      }
      setPreviewMembers(data.members || []);
      setPreviewCount(Number(data.total || 0));
    } catch {
      setError("Eroare de rețea la calcularea preview-ului.");
    } finally {
      setBusyId(null);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusyId(editingId || "new");
    setError(null);
    try {
      const response = await fetch(
        editingId ? `/api/email/segments/${editingId}` : "/api/email/segments",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, definition: definitionFromForm(form) }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut salva segmentul.");
        return;
      }
      await refresh();
      setShowBuilder(false);
      setMessage("Segment custom salvat. Count-ul va fi recalculat dinamic.");
    } catch {
      setError("Eroare de rețea la salvarea segmentului.");
    } finally {
      setBusyId(null);
    }
  };

  const duplicate = async (segment: MarketingSegmentSummary) => {
    setBusyId(segment.id);
    setError(null);
    try {
      const response = await fetch(`/api/email/segments/${segment.id}/duplicate`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut duplica segmentul.");
        return;
      }
      await refresh();
      setEditingId(data.segment.id);
      setForm(formFromSegment(data.segment));
      setPreviewMembers([]);
      setPreviewCount(null);
      setShowBuilder(true);
      setMessage("Copie custom creată. O poți edita acum.");
    } catch {
      setError("Eroare de rețea la duplicarea segmentului.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (segment: MarketingSegmentSummary) => {
    if (!window.confirm(`Ștergi segmentul custom „${segment.name}”?\n\nIstoricul campaniilor rămâne păstrat.`)) return;
    setBusyId(segment.id);
    setError(null);
    try {
      const response = await fetch(`/api/email/segments/${segment.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut șterge segmentul.");
        return;
      }
      if (selected?.id === segment.id) {
        setSelected(null);
        setMembers([]);
        setMemberTotal(0);
      }
      await refresh();
      setMessage("Segment custom arhivat. Istoricul campaniilor este păstrat.");
    } catch {
      setError("Eroare de rețea la ștergerea segmentului.");
    } finally {
      setBusyId(null);
    }
  };

  const useInCampaign = async (segment: MarketingSegmentSummary) => {
    setBusyId(segment.id);
    setError(null);
    try {
      const response = await fetch("/api/email/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${segment.name} — campanie`,
          mode: "blank",
          segment_id: segment.id,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Nu am putut crea draftul.");
        return;
      }
      router.push(`/email/campaigns/${data.campaign.id}`);
    } catch {
      setError("Eroare de rețea la crearea campaniei.");
      setBusyId(null);
    }
  };

  const updateCondition = (index: number, condition: MarketingSegmentCondition) => {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((item, itemIndex) =>
        itemIndex === index ? condition : item,
      ),
    }));
    setPreviewCount(null);
  };

  return (
    <div className="max-w-7xl space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Segments</h1>
          <p className="mt-2 text-sm text-white/55">
            Audiențe dinamice calculate live, cu suppression global înainte de snapshot.
          </p>
        </div>
        <button type="button" onClick={createNew} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">
          Create Segment
        </button>
      </header>

      {(error || message) && (
        <div className="space-y-2 text-sm">
          {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">{error}</p>}
          {message && <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-100">{message}</p>}
        </div>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Frizeo Segments</h2>
          <p className="text-xs text-white/40">System · read-only · evaluate live</p>
        </div>
        <SegmentTable segments={systemSegments} busyId={busyId} onView={view} onUse={useInCampaign} onDuplicate={duplicate} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">Custom Segments</h2>
          <p className="text-xs text-white/40">Condiții whitelist-uite legate exclusiv prin AND.</p>
        </div>
        <SegmentTable segments={customSegments} busyId={busyId} onView={view} onUse={useInCampaign} onDuplicate={duplicate} onEdit={edit} onDelete={remove} />
      </section>

      {showBuilder && (
        <form onSubmit={save} className="space-y-5 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">{editingId ? "Edit Custom Segment" : "Create Custom Segment"}</h2>
              <p className="mt-1 text-xs text-white/40">V1: maximum 10 condiții AND, fără SQL raw.</p>
            </div>
            <button type="button" onClick={() => setShowBuilder(false)} className="text-sm text-white/50 hover:text-white">Close</button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1 text-sm">
              <span className="text-xs text-white/45">Name</span>
              <input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs text-white/45">Category</span>
              <input required value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm md:col-span-3">
              <span className="text-xs text-white/45">Description</span>
              <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2" />
            </label>
          </div>

          <div className="space-y-3">
            {form.conditions.map((condition, index) => {
              const config = segmentFieldConfig(condition.field)!;
              const operators = operatorsForSegmentField(condition.field);
              return (
                <div key={`${index}-${condition.field}`} className="grid gap-2 rounded-lg border border-white/10 p-3 md:grid-cols-[28px_1fr_180px_1fr_auto] md:items-end">
                  <span className="pb-2 text-xs font-semibold text-white/35">{index === 0 ? "" : "AND"}</span>
                  <label className="space-y-1 text-xs text-white/45">
                    Field
                    <select value={condition.field} onChange={(event) => updateCondition(index, defaultCondition(event.target.value as MarketingSegmentField))} className="block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
                      {SEGMENT_FIELD_CONFIG.map((item) => <option key={item.field} value={item.field}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-white/45">
                    Operator
                    <select value={condition.operator} onChange={(event) => {
                      const operator = event.target.value as MarketingSegmentOperator;
                      updateCondition(index, config.kind === "boolean" ? { field: condition.field, operator } : { ...condition, operator });
                    }} className="block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
                      {operators.map((operator) => <option key={operator} value={operator}>{OPERATOR_LABELS[operator]}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs text-white/45">
                    Value
                    {config.kind === "boolean" ? (
                      <div className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-sm text-white/45">{OPERATOR_LABELS[condition.operator]}</div>
                    ) : config.kind === "enum" && condition.operator !== "in" ? (
                      <select value={String(condition.value || "")} onChange={(event) => updateCondition(index, { ...condition, value: event.target.value })} className="block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white">
                        {config.values?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <input
                        type={config.kind === "date" ? "date" : config.kind === "number" ? "number" : "text"}
                        value={Array.isArray(condition.value) ? condition.value.join(", ") : String(condition.value ?? "")}
                        placeholder={condition.operator === "in" ? "value1, value2" : ""}
                        onChange={(event) => updateCondition(index, {
                          ...condition,
                          value: config.kind === "number" ? Number(event.target.value) : condition.operator === "in" ? event.target.value.split(",").map((item) => item.trim()).filter(Boolean) : event.target.value,
                        })}
                        className="block w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                      />
                    )}
                  </label>
                  <button type="button" disabled={form.conditions.length === 1} onClick={() => setForm((current) => ({ ...current, conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-md border border-red-500/20 px-2.5 py-2 text-xs text-red-200 disabled:opacity-30">Remove</button>
                </div>
              );
            })}
            <button type="button" disabled={form.conditions.length >= 10} onClick={() => setForm((current) => ({ ...current, conditions: [...current.conditions, defaultCondition("source")] }))} className="rounded-md border border-white/15 px-3 py-2 text-sm hover:bg-white/10 disabled:opacity-40">
              Add AND condition
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={preview} disabled={busyId !== null} className="rounded-lg border border-white/15 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-40">Preview audience</button>
            <button type="submit" disabled={busyId !== null} className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-40">Save Segment</button>
            <span className="text-sm text-white/55">{previewCount === null ? "Preview necalculat" : `${previewCount} eligible contacts`}</span>
          </div>
          {previewMembers.length > 0 && (
            <p className="text-xs text-white/40">Primele rezultate: {previewMembers.map((member) => member.email).join(", ")}</p>
          )}
        </form>
      )}

      {selected && (
        <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">{selected.name}</h2>
              <p className="mt-1 text-sm text-white/50">{memberTotal} contacte eligibile acum · lista nu este snapshot</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} className="text-sm text-white/50 hover:text-white">Close</button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-black/25 text-left text-white/45"><tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Trial end</th><th className="px-3 py-2">Consent</th></tr></thead>
              <tbody>
                {members.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-white/35">Niciun contact eligibil acum.</td></tr>
                ) : members.map((member) => (
                  <tr key={member.contact_id} className="border-t border-white/5">
                    <td className="px-3 py-2">{[member.first_name, member.last_name].filter(Boolean).join(" ") || "—"}</td>
                    <td className="px-3 py-2 text-white/70">{member.email}</td>
                    <td className="px-3 py-2 text-white/50">{member.source}</td>
                    <td className="px-3 py-2 text-white/50">{member.contact_status}</td>
                    <td className="px-3 py-2 text-white/50">{member.subscription_plan}</td>
                    <td className="px-3 py-2 text-white/50">{member.trial_end_date || "—"}</td>
                    <td className="px-3 py-2 text-emerald-200">{member.consent_status ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

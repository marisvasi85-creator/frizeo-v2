import type {
  MarketingSegmentCondition,
  MarketingSegmentDefinition,
  MarketingSegmentField,
  MarketingSegmentOperator,
} from "@/lib/frizeo-email/types";

type SegmentFieldKind = "enum" | "date" | "number" | "boolean";

export type SegmentFieldConfig = {
  field: MarketingSegmentField;
  label: string;
  kind: SegmentFieldKind;
  values?: { value: string; label: string }[];
};

export const SEGMENT_FIELD_CONFIG: SegmentFieldConfig[] = [
  {
    field: "source",
    label: "Source",
    kind: "enum",
    values: [
      { value: "frizeo_user", label: "Frizeo user" },
      { value: "external_lead", label: "External lead" },
      { value: "csv", label: "CSV" },
      { value: "manual", label: "Manual" },
    ],
  },
  {
    field: "contact_status",
    label: "Contact status",
    kind: "enum",
    values: [
      { value: "subscribed", label: "Subscribed" },
      { value: "unsubscribed", label: "Unsubscribed" },
      { value: "bounced", label: "Bounced" },
      { value: "complained", label: "Complained" },
    ],
  },
  {
    field: "account_status",
    label: "Account status",
    kind: "enum",
    values: [
      { value: "lead", label: "Lead" },
      { value: "registered", label: "Registered" },
    ],
  },
  {
    field: "subscription_plan",
    label: "Subscription plan",
    kind: "enum",
    values: [
      { value: "none", label: "None" },
      { value: "free", label: "Free" },
      { value: "pro", label: "Pro" },
      { value: "pro-plus", label: "Pro+" },
      { value: "custom", label: "Custom" },
    ],
  },
  {
    field: "subscription_status",
    label: "Subscription status",
    kind: "enum",
    values: [
      { value: "none", label: "None" },
      { value: "trialing", label: "Trialing" },
      { value: "active", label: "Active" },
      { value: "past_due", label: "Past due" },
      { value: "canceled", label: "Canceled" },
      { value: "unpaid", label: "Unpaid" },
      { value: "incomplete", label: "Incomplete" },
    ],
  },
  {
    field: "trial_status",
    label: "Trial status",
    kind: "enum",
    values: [
      { value: "none", label: "No trial" },
      { value: "active", label: "Active" },
      { value: "ending_7_days", label: "Ending in 7 days" },
      { value: "ending_3_days", label: "Ending in 3 days" },
      { value: "last_day", label: "Last day" },
      { value: "expired", label: "Expired" },
    ],
  },
  {
    field: "trial_end_date",
    label: "Trial end date",
    kind: "date",
  },
  {
    field: "bookings_count",
    label: "Bookings count",
    kind: "number",
  },
  {
    field: "bookings_count_bucket",
    label: "Bookings count bucket",
    kind: "enum",
    values: [
      { value: "none", label: "No bookings" },
      { value: "1_5", label: "1–5 bookings" },
      { value: "6_plus", label: "6+ bookings" },
    ],
  },
  { field: "created_at", label: "Contact created at", kind: "date" },
  { field: "last_activity", label: "Last login/activity", kind: "date" },
  {
    field: "activity_status",
    label: "Activity status",
    kind: "enum",
    values: [
      { value: "recently_active", label: "Active in last 7 days" },
      { value: "between_7_and_14_days", label: "Active 7–14 days ago" },
      { value: "inactive_14_days", label: "Inactive for 14+ days" },
      { value: "unknown", label: "Unknown" },
    ],
  },
  { field: "consent_status", label: "Marketing consent", kind: "boolean" },
  { field: "is_paid", label: "Paid customer", kind: "boolean" },
];

export function segmentFieldConfig(field: string): SegmentFieldConfig | null {
  return SEGMENT_FIELD_CONFIG.find((item) => item.field === field) ?? null;
}

export function operatorsForSegmentField(
  field: MarketingSegmentField,
): MarketingSegmentOperator[] {
  const kind = segmentFieldConfig(field)?.kind;
  if (kind === "enum") return ["equals", "not_equals", "in"];
  if (kind === "date") return ["equals", "before", "after"];
  if (kind === "number") return ["equals", "greater_than", "less_than"];
  if (kind === "boolean") return ["yes", "no"];
  return [];
}

function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function parseCondition(value: unknown): MarketingSegmentCondition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const config = segmentFieldConfig(String(input.field || ""));
  if (!config) return null;

  const operator = String(input.operator || "") as MarketingSegmentOperator;
  if (!operatorsForSegmentField(config.field).includes(operator)) return null;

  if (config.kind === "boolean") {
    return { field: config.field, operator };
  }

  if (operator === "in") {
    const values = Array.isArray(input.value)
      ? input.value
      : typeof input.value === "string"
        ? input.value.split(",")
        : [];
    const parsed = [...new Set(values.map((item) => String(item).trim()).filter(Boolean))];
    if (parsed.length < 1 || parsed.length > 20 || parsed.some((item) => item.length > 120)) {
      return null;
    }
    return { field: config.field, operator, value: parsed };
  }

  if (config.kind === "number") {
    const parsed = Number(input.value);
    if (!Number.isFinite(parsed)) return null;
    return { field: config.field, operator, value: parsed };
  }

  if (config.kind === "date") {
    if (!isDateString(input.value)) return null;
    return { field: config.field, operator, value: input.value };
  }

  if (typeof input.value !== "string" || !input.value.trim() || input.value.length > 120) {
    return null;
  }
  return { field: config.field, operator, value: input.value.trim() };
}

export function parseMarketingSegmentDefinition(
  value: unknown,
):
  | { ok: true; definition: MarketingSegmentDefinition }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Definiția segmentului este invalidă." };
  }
  const input = value as Record<string, unknown>;
  if (input.logic !== "AND" || Number(input.version) !== 1) {
    return { ok: false, error: "În V1 sunt acceptate doar condiții AND." };
  }
  if (!Array.isArray(input.conditions) || input.conditions.length < 1 || input.conditions.length > 10) {
    return { ok: false, error: "Adaugă între 1 și 10 condiții valide." };
  }

  const conditions = input.conditions.map(parseCondition);
  if (conditions.some((condition) => condition === null)) {
    return { ok: false, error: "Un câmp, operator sau o valoare nu este permisă." };
  }

  return {
    ok: true,
    definition: {
      version: 1,
      logic: "AND",
      conditions: conditions as MarketingSegmentCondition[],
    },
  };
}

export function parseMarketingSegmentInput(value: unknown):
  | {
      ok: true;
      input: {
        name: string;
        description: string;
        category: string;
        definition: MarketingSegmentDefinition;
      };
    }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "JSON invalid." };
  }
  const body = value as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "custom";
  if (!name || name.length > 160) {
    return { ok: false, error: "Numele trebuie să aibă 1–160 caractere." };
  }
  if (description.length > 1000) {
    return { ok: false, error: "Descrierea poate avea maximum 1.000 caractere." };
  }
  if (!category || category.length > 80) {
    return { ok: false, error: "Categoria trebuie să aibă 1–80 caractere." };
  }
  const parsed = parseMarketingSegmentDefinition(body.definition);
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    input: { name, description, category, definition: parsed.definition },
  };
}

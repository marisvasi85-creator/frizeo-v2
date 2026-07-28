import { supabaseAdmin } from "@/lib/supabase/admin";
import { hasSmsSendsTable } from "@/lib/sms/usage";
import {
  createPage,
  dateProp,
  findPageByRichTextEquals,
  getSaloaneDatabaseId,
  numberProp,
  phoneProp,
  richTextProp,
  selectProp,
  titleProp,
  updatePage,
} from "@/lib/notion/client";

type PlanSlug = "free" | "pro" | "pro-plus" | "custom" | string;

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  "pro-plus": "Pro+",
  custom: "Custom",
};

const PLAN_MRR: Record<string, number> = {
  free: 0,
  pro: 79,
  "pro-plus": 199,
};

function mapPlan(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return PLAN_LABEL[slug] || null;
}

function mapStatus(params: {
  status: string | null | undefined;
  planSlug: string | null | undefined;
}): string {
  const status = (params.status || "").toLowerCase();
  if (status === "trialing") return "Trial";
  if (status === "past_due") return "Past due";
  if (status === "canceled" || status === "cancelled" || status === "unpaid") {
    return "Churned";
  }
  if (params.planSlug === "custom" && status === "active") return "Custom";
  if (status === "active") return "Active";
  if (!status) return "Lead";
  return "Lead";
}

function monthBounds(now = new Date()): { start: string; end: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  );
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export type SalonSyncRow = {
  tenantId: string;
  name: string;
  slug: string | null;
  phone: string | null;
  city: string | null;
  planSlug: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  mrr: number | null;
  smsMonth: number;
  bookingsMonth: number;
};

export async function loadSalonSyncRows(): Promise<SalonSyncRow[]> {
  const { data: tenants, error } = await supabaseAdmin
    .from("tenants")
    .select("id, name, slug, phone, location_city")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(`tenants query failed: ${error.message}`);
  }

  const rows = tenants ?? [];
  if (rows.length === 0) return [];

  const tenantIds = rows.map((t) => t.id);
  const { start, end } = monthBounds();

  const [subsRes, bookingsRes, smsRes] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select(
        "tenant_id, status, trial_ends_at, plans(name, slug, price)",
      )
      .in("tenant_id", tenantIds),
    supabaseAdmin
      .from("bookings")
      .select("tenant_id, date")
      .in("tenant_id", tenantIds)
      .gte("date", start)
      .lte("date", end),
    (await hasSmsSendsTable())
      ? supabaseAdmin
          .from("sms_sends")
          .select("tenant_id, usage_date")
          .in("tenant_id", tenantIds)
          .gte("usage_date", start)
          .lte("usage_date", end)
      : Promise.resolve({ data: [] as { tenant_id: string }[], error: null }),
  ]);

  if (subsRes.error) {
    throw new Error(`subscriptions query failed: ${subsRes.error.message}`);
  }
  if (bookingsRes.error) {
    throw new Error(`bookings query failed: ${bookingsRes.error.message}`);
  }
  if (smsRes.error) {
    throw new Error(`sms_sends query failed: ${smsRes.error.message}`);
  }

  const subByTenant = new Map(
    (subsRes.data ?? []).map((s) => [s.tenant_id, s]),
  );

  const bookingsByTenant = new Map<string, number>();
  for (const b of bookingsRes.data ?? []) {
    if (!b.tenant_id) continue;
    bookingsByTenant.set(
      b.tenant_id,
      (bookingsByTenant.get(b.tenant_id) || 0) + 1,
    );
  }

  const smsByTenant = new Map<string, number>();
  for (const s of smsRes.data ?? []) {
    smsByTenant.set(
      s.tenant_id,
      (smsByTenant.get(s.tenant_id) || 0) + 1,
    );
  }

  return rows.map((t) => {
    const sub = subByTenant.get(t.id) as
      | {
          status?: string | null;
          trial_ends_at?: string | null;
          plans?:
            | { name?: string | null; slug?: string | null; price?: number | null }
            | { name?: string | null; slug?: string | null; price?: number | null }[]
            | null;
        }
      | undefined;

    const planRaw = sub?.plans;
    const plan = Array.isArray(planRaw) ? planRaw[0] : planRaw;
    const planSlug = (plan?.slug as PlanSlug | null | undefined) || null;
    const price =
      typeof plan?.price === "number"
        ? plan.price
        : planSlug
          ? PLAN_MRR[planSlug] ?? null
          : null;

    return {
      tenantId: t.id,
      name: t.name,
      slug: t.slug,
      phone: t.phone,
      city: t.location_city,
      planSlug,
      planName: plan?.name || null,
      subscriptionStatus: sub?.status || null,
      trialEndsAt: sub?.trial_ends_at
        ? String(sub.trial_ends_at).slice(0, 10)
        : null,
      mrr: price,
      smsMonth: smsByTenant.get(t.id) || 0,
      bookingsMonth: bookingsByTenant.get(t.id) || 0,
    };
  });
}

function salonProperties(
  row: SalonSyncRow,
  options?: { includeManualDefaults?: boolean },
) {
  const properties: Record<string, unknown> = {
    Name: titleProp(row.name || row.slug || row.tenantId),
    Status: selectProp(
      mapStatus({ status: row.subscriptionStatus, planSlug: row.planSlug }),
    ),
    Plan: selectProp(mapPlan(row.planSlug)),
    "Trial ends": dateProp(row.trialEndsAt),
    MRR: numberProp(row.mrr),
    City: richTextProp(row.city),
    Phone: phoneProp(row.phone),
    "SMS month": numberProp(row.smsMonth),
    "Bookings month": numberProp(row.bookingsMonth),
    "Tenant ID": richTextProp(row.tenantId),
    Slug: richTextProp(row.slug),
  };

  // Don't overwrite founder-managed fields on update.
  if (options?.includeManualDefaults) {
    properties.Notes = richTextProp(
      `Synced ${new Date().toISOString()} · sub=${row.subscriptionStatus || "none"}`,
    );
  }

  return properties;
}

export async function syncSaloaneToNotion(): Promise<{
  synced: number;
  created: number;
  updated: number;
}> {
  const databaseId = getSaloaneDatabaseId();
  if (!databaseId) {
    throw new Error("NOTION_SALOANE_DATABASE_ID is not configured");
  }

  const rows = await loadSalonSyncRows();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const existing = await findPageByRichTextEquals({
      databaseId,
      property: "Tenant ID",
      value: row.tenantId,
    });
    if (existing) {
      await updatePage({
        pageId: existing.id,
        properties: salonProperties(row),
      });
      updated += 1;
    } else {
      await createPage({
        databaseId,
        properties: salonProperties(row, { includeManualDefaults: true }),
      });
      created += 1;
    }
  }

  return { synced: rows.length, created, updated };
}

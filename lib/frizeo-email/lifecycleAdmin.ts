import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  LifecycleSettings,
  LifecycleStage,
  LifecycleTenantRow,
  NextBestAction,
} from "@/lib/frizeo-email/lifecycle";

export type {
  LifecycleSettings,
  LifecycleTenantRow,
} from "@/lib/frizeo-email/lifecycle";

export async function getLifecycleSettings(): Promise<LifecycleSettings> {
  const { data, error } = await supabaseAdmin
    .from("marketing_lifecycle_settings")
    .select(
      "enabled, strategy_version, strategy_started_at, min_hours_between_emails, max_emails_per_day, max_emails_first_7_days, max_emails_30_days, allow_existing_zero_booking_cohort, test_contact_ids, notes",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) {
    return {
      enabled: false,
      strategy_version: 2,
      strategy_started_at: null,
      min_hours_between_emails: 48,
      max_emails_per_day: 1,
      max_emails_first_7_days: 3,
      max_emails_30_days: 5,
      allow_existing_zero_booking_cohort: false,
      test_contact_ids: [],
      notes: "",
    };
  }

  return {
    enabled: Boolean(data.enabled),
    strategy_version: Number(data.strategy_version || 2),
    strategy_started_at: data.strategy_started_at,
    min_hours_between_emails: Number(data.min_hours_between_emails || 48),
    max_emails_per_day: Number(data.max_emails_per_day || 1),
    max_emails_first_7_days: Number(data.max_emails_first_7_days || 3),
    max_emails_30_days: Number(data.max_emails_30_days || 5),
    allow_existing_zero_booking_cohort: Boolean(
      data.allow_existing_zero_booking_cohort,
    ),
    test_contact_ids: Array.isArray(data.test_contact_ids)
      ? data.test_contact_ids
      : [],
    notes: data.notes || "",
  };
}

export async function updateLifecycleSettings(
  patch: Partial<LifecycleSettings>,
): Promise<LifecycleSettings> {
  const { error } = await supabaseAdmin
    .from("marketing_lifecycle_settings")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);
  return getLifecycleSettings();
}

export async function listLifecycleTenants(input: {
  stage?: string;
  outreach?: string;
  limit?: number;
}): Promise<LifecycleTenantRow[]> {
  let query = supabaseAdmin
    .from("tenant_lifecycle_state")
    .select(
      "tenant_id, stage, next_best_action, recorded_bookings, online_bookings, last_activity_at, last_automation_key, last_automation_sent_at, next_eligible_at, outreach_status, unused_reason, enrolled_at",
    )
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 300));

  if (input.stage && input.stage !== "all") {
    query = query.eq("stage", input.stage);
  }
  if (input.outreach && input.outreach !== "all") {
    query = query.eq("outreach_status", input.outreach);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const tenantIds = rows.map((row) => row.tenant_id);
  const tenantMap = new Map<
    string,
    { name: string | null; slug: string | null }
  >();
  const contactMap = new Map<string, string>();

  if (tenantIds.length > 0) {
    const [{ data: tenants }, { data: contacts }] = await Promise.all([
      supabaseAdmin
        .from("tenants")
        .select("id, name, slug")
        .in("id", tenantIds),
      supabaseAdmin
        .from("marketing_contacts")
        .select("tenant_id, email")
        .in("tenant_id", tenantIds)
        .is("deleted_at", null),
    ]);
    for (const tenant of tenants ?? []) {
      tenantMap.set(tenant.id, { name: tenant.name, slug: tenant.slug });
    }
    for (const contact of contacts ?? []) {
      if (contact.tenant_id && !contactMap.has(contact.tenant_id)) {
        contactMap.set(contact.tenant_id, contact.email);
      }
    }
  }

  return rows.map((row) => {
    const tenant = tenantMap.get(row.tenant_id);
    return {
      tenant_id: row.tenant_id,
      tenant_name: tenant?.name ?? null,
      tenant_slug: tenant?.slug ?? null,
      stage: row.stage as LifecycleStage,
      next_best_action: row.next_best_action as NextBestAction,
      recorded_bookings: row.recorded_bookings,
      online_bookings: row.online_bookings,
      last_activity_at: row.last_activity_at,
      last_automation_key: row.last_automation_key,
      last_automation_sent_at: row.last_automation_sent_at,
      next_eligible_at: row.next_eligible_at,
      outreach_status: row.outreach_status,
      unused_reason: row.unused_reason,
      enrolled_at: row.enrolled_at,
      contact_email: contactMap.get(row.tenant_id) ?? null,
    };
  });
}

export async function getLifecycleFunnel(): Promise<Record<string, number>> {
  const { data, error } = await supabaseAdmin.rpc("marketing_lifecycle_funnel");
  if (error) throw new Error(error.message);
  return (data ?? {}) as Record<string, number>;
}

export async function updateTenantOutreach(input: {
  tenantId: string;
  outreachStatus?: string;
  unusedReason?: string | null;
}): Promise<void> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.outreachStatus) patch.outreach_status = input.outreachStatus;
  if (input.unusedReason !== undefined) patch.unused_reason = input.unusedReason;
  const { error } = await supabaseAdmin
    .from("tenant_lifecycle_state")
    .update(patch)
    .eq("tenant_id", input.tenantId);
  if (error) throw new Error(error.message);
}

export async function classifyTenantLifecycle(tenantId: string) {
  const { data, error } = await supabaseAdmin.rpc(
    "refresh_tenant_lifecycle_state",
    { p_tenant_id: tenantId },
  );
  if (error) throw new Error(error.message);
  return data;
}

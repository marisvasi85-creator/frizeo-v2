import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  MarketingAutomation,
  MarketingAutomationRun,
  MarketingAutomationRunStatus,
  MarketingAutomationSummary,
} from "@/lib/frizeo-email/types";

export type ClaimedAutomationRun = {
  run_id: string;
  automation_id: string;
  automation_key: string;
  contact_id: string;
  contact_email: string;
  first_name: string | null;
  last_name: string | null;
  tenant_id: string | null;
  user_id: string | null;
  trigger_key: string;
  trigger_reference: string;
  attempt_count: number;
  claim_token: string;
  unsubscribe_token: string | null;
  template_id: string;
  subject: string;
  preview_text: string;
  heading: string;
  body_text: string;
  image_url: string | null;
  cta_text: string | null;
  cta_url: string | null;
  footer_text: string;
  cta_url_type: string | null;
  conditions: Record<string, unknown>;
  trial_end_date: string | null;
};

export async function listAutomationsWithStats(): Promise<
  MarketingAutomationSummary[]
> {
  const { data: automations, error } = await supabaseAdmin
    .from("marketing_automations")
    .select(
      "id, automation_key, name, description, trigger_type, delay_minutes, template_id, conditions, is_system, is_active, created_at, updated_at",
    )
    .order("automation_key", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = automations ?? [];
  const ids = rows.map((row) => row.id);
  const templateIds = [
    ...new Set(rows.map((row) => row.template_id).filter(Boolean)),
  ];

  const templateMap = new Map<
    string,
    { name: string | null; template_key: string | null }
  >();
  if (templateIds.length > 0) {
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from("marketing_email_templates")
      .select("id, name, template_key")
      .in("id", templateIds);
    if (templatesError) throw new Error(templatesError.message);
    for (const template of templates ?? []) {
      templateMap.set(template.id, {
        name: template.name,
        template_key: template.template_key,
      });
    }
  }

  const counts = new Map<
    string,
    { sent: number; skipped: number; failed: number; last_run_at: string | null }
  >();

  if (ids.length > 0) {
    const { data: runs, error: runsError } = await supabaseAdmin
      .from("marketing_automation_runs")
      .select("automation_id, status, completed_at, created_at")
      .in("automation_id", ids)
      .eq("is_test", false);

    if (runsError) throw new Error(runsError.message);

    for (const run of runs ?? []) {
      const current = counts.get(run.automation_id) ?? {
        sent: 0,
        skipped: 0,
        failed: 0,
        last_run_at: null,
      };
      if (run.status === "sent") current.sent += 1;
      if (run.status === "skipped") current.skipped += 1;
      if (run.status === "failed") current.failed += 1;
      const stamp = run.completed_at || run.created_at;
      if (
        stamp &&
        (!current.last_run_at || stamp > current.last_run_at)
      ) {
        current.last_run_at = stamp;
      }
      counts.set(run.automation_id, current);
    }
  }

  return rows.map((row) => {
    const template = templateMap.get(row.template_id);
    const stats = counts.get(row.id) ?? {
      sent: 0,
      skipped: 0,
      failed: 0,
      last_run_at: null,
    };

    return {
      id: row.id,
      automation_key: row.automation_key,
      name: row.name,
      description: row.description,
      trigger_type: row.trigger_type,
      delay_minutes: row.delay_minutes,
      template_id: row.template_id,
      template_name: template?.name ?? null,
      template_key: template?.template_key ?? null,
      conditions: (row.conditions ?? {}) as Record<string, unknown>,
      is_system: row.is_system,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      sent_count: stats.sent,
      skipped_count: stats.skipped,
      failed_count: stats.failed,
      last_run_at: stats.last_run_at,
    } satisfies MarketingAutomationSummary;
  });
}

export async function getAutomation(
  id: string,
): Promise<MarketingAutomation | null> {
  const { data, error } = await supabaseAdmin
    .from("marketing_automations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as MarketingAutomation | null) ?? null;
}

export async function setAutomationActive(
  id: string,
  isActive: boolean,
): Promise<MarketingAutomation> {
  // Caller must already be platform-admin gated (API/layout).
  // Uses service role so we do not depend on JWT inside the RPC.
  const { data, error } = await supabaseAdmin
    .from("marketing_automations")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("automation_not_found");

  if (!isActive) {
    await supabaseAdmin
      .from("marketing_automation_runs")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        skip_reason: "automation_paused",
        completed_at: new Date().toISOString(),
      })
      .eq("automation_id", id)
      .eq("is_test", false)
      .in("status", ["pending", "scheduled"]);
  }

  return data as MarketingAutomation;
}

export async function listAutomationRuns(input: {
  automationId: string;
  status?: MarketingAutomationRunStatus | "all";
  limit?: number;
}): Promise<MarketingAutomationRun[]> {
  let query = supabaseAdmin
    .from("marketing_automation_runs")
    .select("*")
    .eq("automation_id", input.automationId)
    .eq("is_test", false)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 200));

  if (input.status && input.status !== "all") {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as MarketingAutomationRun[];
  const contactIds = [
    ...new Set(rows.map((row) => row.contact_id).filter(Boolean)),
  ];
  const contactMap = new Map<
    string,
    { email: string | null; first_name: string | null; last_name: string | null }
  >();

  if (contactIds.length > 0) {
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from("marketing_contacts")
      .select("id, email, first_name, last_name")
      .in("id", contactIds);
    if (contactsError) throw new Error(contactsError.message);
    for (const contact of contacts ?? []) {
      contactMap.set(contact.id, {
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
      });
    }
  }

  return rows.map((row) => {
    const contact = contactMap.get(row.contact_id);
    return {
      ...row,
      contact_email: contact?.email ?? null,
      contact_first_name: contact?.first_name ?? null,
      contact_last_name: contact?.last_name ?? null,
    };
  });
}

export async function listContactAutomationRuns(
  contactId: string,
): Promise<
  Array<{
    automation_key: string;
    automation_name: string;
    status: string;
    sent_at: string | null;
    skip_reason: string | null;
    created_at: string;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from("marketing_automation_runs")
    .select("automation_id, status, sent_at, skip_reason, created_at")
    .eq("contact_id", contactId)
    .eq("is_test", false)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const automationIds = [
    ...new Set(rows.map((row) => row.automation_id).filter(Boolean)),
  ];
  const automationMap = new Map<
    string,
    { automation_key: string; name: string }
  >();

  if (automationIds.length > 0) {
    const { data: automations, error: automationsError } = await supabaseAdmin
      .from("marketing_automations")
      .select("id, automation_key, name")
      .in("id", automationIds);
    if (automationsError) throw new Error(automationsError.message);
    for (const automation of automations ?? []) {
      automationMap.set(automation.id, {
        automation_key: automation.automation_key,
        name: automation.name,
      });
    }
  }

  return rows.map((row) => {
    const automation = automationMap.get(row.automation_id);
    return {
      automation_key: automation?.automation_key ?? "unknown",
      automation_name: automation?.name ?? "Automation",
      status: row.status,
      sent_at: row.sent_at,
      skip_reason: row.skip_reason,
      created_at: row.created_at,
    };
  });
}

export async function discoverAutomationRuns(limit = 200) {
  const { data, error } = await supabaseAdmin.rpc(
    "discover_marketing_automation_runs",
    { p_limit: limit },
  );
  if (error) throw new Error(error.message);
  return data as { inserted: number; today: string };
}

export async function claimAutomationRunBatch(input: {
  batchSize: number;
  leaseSeconds: number;
  maxAttempts: number;
}): Promise<ClaimedAutomationRun[]> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_marketing_automation_run_batch",
    {
      p_batch_size: input.batchSize,
      p_lease_seconds: input.leaseSeconds,
      p_max_attempts: input.maxAttempts,
    },
  );
  if (error) throw new Error(error.message);
  return (data ?? []) as ClaimedAutomationRun[];
}

export async function recordAutomationRunResult(input: {
  runId: string;
  claimToken: string;
  outcome: "sent" | "skipped" | "failed" | "retry";
  provider?: string | null;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  skipReason?: string | null;
  temporary?: boolean;
  retryDelaySeconds?: number;
  maxAttempts?: number;
}): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "record_marketing_automation_run_result",
    {
      p_run_id: input.runId,
      p_claim_token: input.claimToken,
      p_outcome: input.outcome,
      p_provider: input.provider ?? null,
      p_provider_message_id: input.providerMessageId ?? null,
      p_error_message: input.errorMessage ?? null,
      p_skip_reason: input.skipReason ?? null,
      p_temporary: input.temporary ?? false,
      p_retry_delay_seconds: input.retryDelaySeconds ?? 60,
      p_max_attempts: input.maxAttempts ?? 4,
    },
  );
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function evaluateAutomationConditions(
  contactId: string,
  conditions: Record<string, unknown>,
): Promise<{ ok: boolean; skip_reason: string | null }> {
  const { data, error } = await supabaseAdmin.rpc(
    "marketing_automation_condition_ok",
    {
      p_contact_id: contactId,
      p_conditions: conditions,
    },
  );
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: Boolean(row?.ok),
    skip_reason: row?.skip_reason ?? null,
  };
}

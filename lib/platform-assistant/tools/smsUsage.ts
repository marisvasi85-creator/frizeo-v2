import {
  addDaysToDateString,
  getTodayInBookingTimezone,
} from "@/lib/bookings/bookingTimezone";
import {
  hasSmsSendsTable,
  SMS_TYPES,
  smsSendsMigrationMessage,
  type SmsType,
} from "@/lib/sms/usage";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber, asString, resolveTenant } from "./helpers";

type SmsSendRow = {
  tenant_id: string;
  sms_type: string;
  ok: boolean;
  usage_date: string;
};

function emptyByType(): Record<SmsType, { sent: number; failed: number }> {
  return {
    booking: { sent: 0, failed: 0 },
    reminder: { sent: 0, failed: 0 },
    reschedule: { sent: 0, failed: 0 },
    cancel: { sent: 0, failed: 0 },
  };
}

function parseSmsType(value: string | null): SmsType | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return (SMS_TYPES as string[]).includes(normalized)
    ? (normalized as SmsType)
    : null;
}

/**
 * Contorizează SMS-urile trimise (platformă sau pe un salon).
 */
export async function smsUsageTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  if (!(await hasSmsSendsTable())) {
    return {
      ok: false,
      summary: smsSendsMigrationMessage(),
      error: "sms_sends_missing",
    };
  }

  const days = Math.min(Math.max(asNumber(args.days) ?? 30, 1), 90);
  const smsType = parseSmsType(asString(args.sms_type) || asString(args.type));
  if (
    (asString(args.sms_type) || asString(args.type)) &&
    !smsType
  ) {
    return {
      ok: false,
      summary: `Tip SMS invalid. Folosește: ${SMS_TYPES.join(", ")}.`,
      error: "invalid_sms_type",
    };
  }

  const wantsTenant =
    Boolean(asString(args.tenant_id)) ||
    Boolean(asString(args.slug)) ||
    Boolean(asString(args.name)) ||
    Boolean(asString(args.tenant_name));

  let tenantId: string | null = null;
  let tenantName: string | null = null;
  let tenantSlug: string | null = null;

  if (wantsTenant) {
    const resolved = await resolveTenant(args);
    if (resolved.ambiguous?.length) {
      return {
        ok: false,
        summary: `Am găsit mai multe saloane: ${resolved.ambiguous
          .map((t) => `${t.name} (${t.slug})`)
          .join(", ")}. Specifică slug sau tenant_id.`,
        data: { ambiguous: resolved.ambiguous },
        error: "ambiguous_tenant",
      };
    }
    if (!resolved.tenant) {
      return {
        ok: false,
        summary: "Nu am găsit salonul.",
        error: "tenant_not_found",
      };
    }
    tenantId = resolved.tenant.id;
    tenantName = resolved.tenant.name;
    tenantSlug = resolved.tenant.slug;
  }

  const today = getTodayInBookingTimezone();
  const fromDate = addDaysToDateString(today, -(days - 1));

  let query = supabaseAdmin
    .from("sms_sends")
    .select("tenant_id, sms_type, ok, usage_date")
    .gte("usage_date", fromDate)
    .lte("usage_date", today);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }
  if (smsType) {
    query = query.eq("sms_type", smsType);
  }

  const { data, error } = await query.limit(10000);

  if (error) {
    console.error("sms_usage query:", error);
    return {
      ok: false,
      summary: "Nu am putut citi consumul de SMS.",
      error: error.message,
    };
  }

  const rows = (data ?? []) as SmsSendRow[];
  const byType = emptyByType();
  const byDay = new Map<string, { sent: number; failed: number }>();
  const byTenant = new Map<string, { sent: number; failed: number }>();

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const type = parseSmsType(row.sms_type) ?? null;
    if (row.ok) {
      sent += 1;
      if (type) byType[type].sent += 1;
    } else {
      failed += 1;
      if (type) byType[type].failed += 1;
    }

    const day = row.usage_date;
    const dayBucket = byDay.get(day) ?? { sent: 0, failed: 0 };
    if (row.ok) dayBucket.sent += 1;
    else dayBucket.failed += 1;
    byDay.set(day, dayBucket);

    const tenantBucket = byTenant.get(row.tenant_id) ?? {
      sent: 0,
      failed: 0,
    };
    if (row.ok) tenantBucket.sent += 1;
    else tenantBucket.failed += 1;
    byTenant.set(row.tenant_id, tenantBucket);
  }

  const byDaySorted = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

  let topTenants:
    | Array<{
        tenant_id: string;
        name: string | null;
        slug: string | null;
        sent: number;
        failed: number;
        total: number;
      }>
    | undefined;

  if (!tenantId && byTenant.size > 0) {
    const ids = [...byTenant.keys()];
    const { data: tenants } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug")
      .in("id", ids);

    const tenantById = new Map(
      (tenants ?? []).map((t) => [t.id, t] as const),
    );

    topTenants = [...byTenant.entries()]
      .map(([id, counts]) => {
        const t = tenantById.get(id);
        return {
          tenant_id: id,
          name: t?.name ?? null,
          slug: t?.slug ?? null,
          sent: counts.sent,
          failed: counts.failed,
          total: counts.sent + counts.failed,
        };
      })
      .sort((a, b) => b.sent - a.sent || b.total - a.total)
      .slice(0, 15);
  }

  const scope = tenantName
    ? `${tenantName}${tenantSlug ? ` (${tenantSlug})` : ""}`
    : "toată platforma";

  const typeBits = SMS_TYPES.filter(
    (t) => byType[t].sent + byType[t].failed > 0,
  )
    .map((t) => `${t}: ${byType[t].sent} ok / ${byType[t].failed} fail`)
    .join("; ");

  const summaryParts = [
    `SMS ultimele ${days} zile (${scope}): ${sent} trimise ok, ${failed} eșuate.`,
  ];
  if (typeBits) summaryParts.push(`Pe tip — ${typeBits}.`);
  if (topTenants?.length) {
    const leaders = topTenants
      .slice(0, 5)
      .map((t) => `${t.name || t.slug || "salon"}: ${t.sent}`)
      .join(", ");
    summaryParts.push(`Top saloane: ${leaders}.`);
  }

  return {
    ok: true,
    summary: summaryParts.join(" "),
    data: {
      days,
      from_date: fromDate,
      to_date: today,
      tenant_id: tenantId,
      tenant_name: tenantName,
      tenant_slug: tenantSlug,
      sms_type_filter: smsType,
      sent,
      failed,
      total_attempts: sent + failed,
      by_type: byType,
      by_day: byDaySorted,
      top_tenants: topTenants,
    },
  };
}

import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export const ANALYTICS_RANGES = [1, 7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type AnalyticsDashboard = {
  range: { from: string; to: string };
  traffic: {
    page_views: number;
    visitors: number;
    sessions: number;
    leads: number;
    signup_views: number;
    pricing_views: number;
  };
  conversions: {
    signups: number;
    trials: number;
    paid: number;
    mrr: number;
    currency: string;
  };
  email: {
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  };
  sources: Array<{
    source: string;
    sessions: number;
    visitors: number;
    leads: number;
    signups: number;
    trials: number;
    paid: number;
  }>;
  daily: Array<{
    day: string;
    page_views: number;
    visitors: number;
    sessions: number;
    leads: number;
    signups: number;
    trials: number;
    paid: number;
  }>;
  recent: Array<{
    kind: "traffic" | "conversion";
    event_name: string;
    source: string;
    path: string | null;
    occurred_at: string;
  }>;
};

export function parseAnalyticsRange(value: string | undefined): AnalyticsRange {
  const parsed = Number(value);
  return ANALYTICS_RANGES.includes(parsed as AnalyticsRange)
    ? (parsed as AnalyticsRange)
    : 30;
}

function asNumber(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeDashboard(raw: unknown): AnalyticsDashboard {
  const data = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const traffic = (data.traffic ?? {}) as Record<string, unknown>;
  const conversions = (data.conversions ?? {}) as Record<string, unknown>;
  const email = (data.email ?? {}) as Record<string, unknown>;
  const range = (data.range ?? {}) as Record<string, unknown>;
  const list = <T>(value: unknown): T[] => (Array.isArray(value) ? value : []);

  return {
    range: {
      from: String(range.from ?? ""),
      to: String(range.to ?? ""),
    },
    traffic: {
      page_views: asNumber(traffic.page_views),
      visitors: asNumber(traffic.visitors),
      sessions: asNumber(traffic.sessions),
      leads: asNumber(traffic.leads),
      signup_views: asNumber(traffic.signup_views),
      pricing_views: asNumber(traffic.pricing_views),
    },
    conversions: {
      signups: asNumber(conversions.signups),
      trials: asNumber(conversions.trials),
      paid: asNumber(conversions.paid),
      mrr: asNumber(conversions.mrr),
      currency: String(conversions.currency ?? "RON"),
    },
    email: {
      sent: asNumber(email.sent),
      delivered: asNumber(email.delivered),
      opened: asNumber(email.opened),
      clicked: asNumber(email.clicked),
      bounced: asNumber(email.bounced),
      unsubscribed: asNumber(email.unsubscribed),
    },
    sources: list<AnalyticsDashboard["sources"][number]>(data.sources).map(
      (item) => ({
        ...item,
        sessions: asNumber(item.sessions),
        visitors: asNumber(item.visitors),
        leads: asNumber(item.leads),
        signups: asNumber(item.signups),
        trials: asNumber(item.trials),
        paid: asNumber(item.paid),
      }),
    ),
    daily: list<AnalyticsDashboard["daily"][number]>(data.daily).map(
      (item) => ({
        ...item,
        page_views: asNumber(item.page_views),
        visitors: asNumber(item.visitors),
        sessions: asNumber(item.sessions),
        leads: asNumber(item.leads),
        signups: asNumber(item.signups),
        trials: asNumber(item.trials),
        paid: asNumber(item.paid),
      }),
    ),
    recent: list<AnalyticsDashboard["recent"][number]>(data.recent),
  };
}

export async function getOwnerAnalyticsDashboard(
  days: AnalyticsRange,
): Promise<AnalyticsDashboard> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const { data, error } = await supabaseAdmin.rpc(
    "get_owner_analytics_dashboard",
    { p_from: from.toISOString(), p_to: to.toISOString() },
  );
  if (error) throw new Error(error.message);
  return normalizeDashboard(data);
}

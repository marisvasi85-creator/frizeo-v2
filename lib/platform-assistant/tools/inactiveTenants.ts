import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asNumber, asString } from "./helpers";
import { loadGrowthSnapshot } from "../growth/snapshot";
import {
  inferInactiveReason,
  matchesInactiveFilter,
} from "../growth/reasons";
import type { GrowthFilter } from "../growth/types";

const FILTERS: GrowthFilter[] = [
  "zero_bookings",
  "no_login",
  "no_services",
  "no_schedule",
  "trial_ending_soon",
  "trial_expired",
];

function parseFilter(raw: string | null): GrowthFilter | null {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (FILTERS.includes(cleaned as GrowthFilter)) return cleaned as GrowthFilter;
  if (cleaned === "0_bookings" || cleaned === "no_bookings") {
    return "zero_bookings";
  }
  if (cleaned === "no_login_days" || cleaned === "inactive_login") {
    return "no_login";
  }
  return null;
}

export async function inactiveTenantsTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const filter = parseFilter(
    asString(args.filter) || asString(args.issue) || asString(args.kind),
  );
  if (
    (asString(args.filter) || asString(args.issue) || asString(args.kind)) &&
    !filter
  ) {
    return {
      ok: false,
      summary: `Filtru invalid. Folosește: ${FILTERS.join(", ")}.`,
      error: "invalid_filter",
    };
  }

  const noLoginDays = Math.min(Math.max(asNumber(args.days) ?? 14, 3), 180);
  const limit = Math.min(Math.max(asNumber(args.limit) ?? 20, 1), 50);

  const loaded = await loadGrowthSnapshot();
  if (loaded.error && loaded.tenants.length === 0) {
    return {
      ok: false,
      summary: "Nu am putut încărca saloanele inactive.",
      error: loaded.error,
    };
  }

  const scored = loaded.tenants
    .filter((t) => matchesInactiveFilter(t, filter, noLoginDays))
    .map((t) => {
      const inferred = inferInactiveReason(t);
      return { tenant: t, ...inferred };
    })
    .sort((a, b) => a.priority - b.priority || (b.tenant.days_since_login ?? 0) - (a.tenant.days_since_login ?? 0));

  const top = scored.slice(0, limit);

  const rows = top.map(({ tenant, reason, suggestion }) => ({
    name: tenant.name,
    slug: tenant.slug,
    owner: tenant.owner_name,
    email: tenant.owner_email,
    phone: tenant.phone,
    city: tenant.city,
    created_at: tenant.created_at,
    last_login_at: tenant.last_login_at,
    last_booking_date: tenant.last_booking_date,
    trial_status: tenant.is_trialing
      ? "trialing"
      : tenant.trial_expired
        ? "expired"
        : tenant.subscription_status,
    trial_ends_at: tenant.trial_ends_at,
    bookings_ever: tenant.bookings_ever,
    reason,
    suggestion,
  }));

  const summary = filter
    ? `${top.length} saloane (${filter}${filter === "no_login" ? `, ≥${noLoginDays} zile` : ""}). Prioritate: ${
        rows[0] ? `${rows[0].name} — ${rows[0].reason}` : "nimic"
      }.`
    : `${scored.length} saloane fără activitate (top ${top.length}). ${
        rows[0]
          ? `Cel mai urgent: ${rows[0].name} — ${rows[0].reason}`
          : "Nimeni pe listă."
      }`;

  return {
    ok: true,
    summary,
    data: {
      filter,
      no_login_days: noLoginDays,
      total_matched: scored.length,
      truncated: scored.length > top.length,
      tenants: rows,
    },
  };
}

import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PlatformToolContext, PlatformToolResult } from "../types";
import { asString } from "./helpers";

export async function tenantDetailTool(
  args: Record<string, unknown>,
  _ctx: PlatformToolContext,
): Promise<PlatformToolResult> {
  const tenantId = asString(args.tenant_id);
  const slug = asString(args.slug)?.toLowerCase() || null;
  const nameQuery = asString(args.name);

  if (!tenantId && !slug && !nameQuery) {
    return {
      ok: false,
      summary: "Specifică tenant_id, slug sau name.",
      error: "missing_lookup",
    };
  }

  let tenant: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    created_at: string;
    address?: string | null;
  } | null = null;

  if (tenantId) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, phone, created_at, address")
      .eq("id", tenantId)
      .maybeSingle();
    tenant = data;
  } else if (slug) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, phone, created_at, address")
      .eq("slug", slug)
      .maybeSingle();
    tenant = data;
  } else if (nameQuery) {
    const { data } = await supabaseAdmin
      .from("tenants")
      .select("id, name, slug, phone, created_at, address")
      .ilike("name", `%${nameQuery}%`)
      .limit(5);
    if (!data?.length) {
      return {
        ok: false,
        summary: `Nu am găsit salon „${nameQuery}".`,
        error: "not_found",
      };
    }
    if (data.length > 1) {
      return {
        ok: false,
        summary: `Mai multe saloane potrivesc „${nameQuery}". Specifică slug sau tenant_id.`,
        error: "ambiguous",
        data: {
          candidates: data.map((t) => ({
            tenant_id: t.id,
            name: t.name,
            slug: t.slug,
          })),
        },
      };
    }
    tenant = data[0];
  }

  if (!tenant) {
    return {
      ok: false,
      summary: "Salonul nu a fost găsit.",
      error: "not_found",
    };
  }

  const monthStart = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  )
    .toISOString()
    .slice(0, 10);

  const [subRes, barbersRes, bookingsCountRes, ownersRes] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select(
        "status, trial_ends_at, stripe_subscription_id, stripe_customer_id, plans(name, slug, max_barbers, max_bookings_per_month)",
      )
      .eq("tenant_id", tenant.id)
      .maybeSingle(),
    supabaseAdmin
      .from("barbers")
      .select("id, display_name, active, slug")
      .eq("tenant_id", tenant.id)
      .order("display_name"),
    supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .gte("date", monthStart)
      .neq("status", "cancelled"),
    supabaseAdmin
      .from("tenant_users")
      .select("user_id, role")
      .eq("tenant_id", tenant.id)
      .eq("role", "owner"),
  ]);

  const sub = subRes.data;
  const plan = sub?.plans as
    | {
        name?: string;
        slug?: string;
        max_barbers?: number | null;
        max_bookings_per_month?: number | null;
      }
    | null
    | undefined;

  const ownerIds = (ownersRes.data ?? []).map((o) => o.user_id);
  const ownerEmails: string[] = [];
  for (const id of ownerIds.slice(0, 3)) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      if (data.user?.email) ownerEmails.push(data.user.email);
    } catch {
      // ignore
    }
  }

  const data = {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      phone: tenant.phone,
      address: tenant.address || null,
      created_at: tenant.created_at,
      public_path: tenant.slug ? `/booking/salon/${tenant.slug}` : null,
    },
    subscription: sub
      ? {
          status: sub.status,
          trial_ends_at: sub.trial_ends_at,
          has_stripe_subscription: Boolean(sub.stripe_subscription_id),
          has_stripe_customer: Boolean(sub.stripe_customer_id),
          plan_name: plan?.name || null,
          plan_slug: plan?.slug || null,
          max_barbers: plan?.max_barbers ?? null,
          max_bookings_per_month: plan?.max_bookings_per_month ?? null,
        }
      : null,
    barbers: (barbersRes.data ?? []).map((b) => ({
      id: b.id,
      name: b.display_name,
      active: b.active,
      slug: b.slug,
    })),
    bookings_this_month: bookingsCountRes.count ?? 0,
    owner_emails: ownerEmails,
  };

  return {
    ok: true,
    summary: `${tenant.name}: plan ${plan?.name || "—"} (${sub?.status || "fără sub"}), ${data.barbers.filter((b) => b.active).length} frizeri activi, ${data.bookings_this_month} programări luna asta.`,
    data,
  };
}
